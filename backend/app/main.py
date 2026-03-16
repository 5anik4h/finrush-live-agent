import os
import sys
import asyncio
import logging
import json
import time as _time
import sentry_sdk
from datetime import datetime, timezone
from app.services.price_service import fetch_current_price
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Query, Header, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.api.auth import validate_supabase_jwt, get_supabase_jwt_payload

load_dotenv()

# Sentry — init before anything else so it captures startup errors too
_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.getenv("ENV", "production"),
        traces_sample_rate=0.2,
        integrations=[],  # FastAPI auto-instrumented via sentry-sdk[fastapi]
    )

# Structured JSON logging
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        if record.exc_info:
            log["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(log)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger("finvoice")

# Fail fast if critical secrets are missing
_required_env = ["SUPABASE_JWT_SECRET"]
_missing = [v for v in _required_env if not os.getenv(v)]
if _missing:
    logger.error("Missing required environment variables: %s — aborting.", ", ".join(_missing))
    sys.exit(1)

cors_origins_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app = FastAPI(title="Finrush Backend", description="Backend for Finrush Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


# In a distributed environment, we use Supabase table `active_sessions`
MAX_SESSIONS_PER_USER = 1
MAX_GLOBAL_SESSIONS = 100

# Metrics refresh cooldown: prevents N parallel frontend calls from triggering N DB recomputes.
# Dict is in-process (per Cloud Run instance) — sufficient since each instance handles its own sessions.
_metrics_refresh_cooldown: dict[str, float] = {}  # user_id → monotonic timestamp of last refresh
_METRICS_COOLDOWN_S = 20.0

# Price proxy rate limiting: protects Cloud Run IP from being banned by Yahoo Finance.
# Sliding window per client IP: max 30 requests per 60 seconds.
_price_rate_limit: dict[str, list[float]] = {}  # IP → [monotonic timestamps]
_PRICE_RATE_LIMIT_MAX = 30
_PRICE_RATE_WINDOW_S = 60.0

@app.get("/")
async def root_redirect():
    # Phase 6, Item 4 - Backend API root polish
    return RedirectResponse(url="https://finrush.app", status_code=302)

@app.get("/api/rates")
async def get_exchange_rates():
    """
    Exchange rates from DB (manual management).
    """
    from app.services.supabase_client import get_supabase_client
    fallback = {"USD": 1.0, "EUR": 0.92, "GBP": 0.79}
    supabase = get_supabase_client()

    # Try reading rates from DB
    try:
        resp = supabase.table("exchange_rates").select("currency, rate_vs_usd").execute()
        if hasattr(resp, "data") and resp.data:
            cached = {row["currency"]: float(row["rate_vs_usd"]) for row in resp.data}
            if "EUR" in cached and "GBP" in cached:
                logger.debug("Exchange rates loaded from DB: %s", cached)
                return {"USD": 1.0, "EUR": cached["EUR"], "GBP": cached["GBP"]}
        else:
            logger.warning("No data returned from exchange_rates table")
    except Exception as e:
        logger.error("DB rate read failed in /api/rates: %s", e, exc_info=True)

    return fallback


@app.get("/api/prices/{ticker}")
async def get_price(ticker: str, request: Request, asset_type: str = "stock"):
    """
    Proxy to fetch prices from Yahoo Finance to avoid CORS issues in frontend.
    Rate limited: 30 requests per 60 seconds per IP.
    """
    client_ip = (request.headers.get("X-Forwarded-For") or request.client.host or "unknown").split(",")[0].strip()
    now = _time.monotonic()
    times = _price_rate_limit.get(client_ip, [])
    times = [t for t in times if now - t < _PRICE_RATE_WINDOW_S]
    if len(times) >= _PRICE_RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in 60 seconds.")
    times.append(now)
    _price_rate_limit[client_ip] = times

    price = await fetch_current_price(ticker, asset_type)
    if price is not None:
        return {"price": price}

    return {"error": "Could not fetch prices. Yahoo Finance might be blocked."}

@app.post("/api/snapshots")
async def generate_monthly_snapshot(
    body: dict | None = None,
):
    """
    Generate/update monthly snapshot. Called from frontend with Supabase auth token.
    Body: { "year": int, "month": int, "token": str }
    """
    from app.services.supabase_client import get_supabase_client
    from app.services import snapshot_service

    if not body or "token" not in body:
        return {"error": "Missing auth token"}

    token = body["token"]
    try:
        user_id = validate_supabase_jwt(token)
        if not user_id:
            return {"error": "Invalid token"}
    except Exception:
        return {"error": "Invalid token"}

    now = datetime.now(timezone.utc)
    year = body.get("year", now.year if now.month > 1 else now.year - 1)
    month = body.get("month", now.month - 1 if now.month > 1 else 12)

    supabase = get_supabase_client()
    return await snapshot_service.generate(supabase, user_id, year, month)



@app.post("/api/metrics/refresh")
async def manual_refresh_metrics(
    user_id: str = Query(...),
    authorization: str | None = Header(None)
):
    """Manually trigger a metrics refresh for a user."""
    try:
        from app.services.metrics_service import refresh_user_metrics
        from app.services.supabase_client import get_supabase_client

        if not authorization or not authorization.startswith("Bearer "):
            return {"success": False, "error": "Missing or invalid authorization header"}, 401
        
        token = authorization.split("Bearer ")[1]
        token_user_id = validate_supabase_jwt(token)
        
        if not token_user_id or token_user_id != user_id:
            return {"success": False, "error": "Unauthorized"}, 401

        # Cooldown: skip recompute if last refresh was less than 20s ago.
        # This prevents N parallel frontend calls from triggering N full DB recomputes.
        now = _time.monotonic()
        last = _metrics_refresh_cooldown.get(user_id, 0.0)
        if now - last < _METRICS_COOLDOWN_S:
            return {"success": True, "skipped": True, "reason": "cooldown"}
        _metrics_refresh_cooldown[user_id] = now

        supabase = get_supabase_client()
        result = refresh_user_metrics(supabase, user_id)

        return {"success": True, "metrics": result}
    except Exception as e:
        logger.error("Error refreshing metrics: %s", e)
        return {"success": False, "error": str(e)}, 500


@app.get("/health")
async def health_check():
    # Phase 3, Item 9 — Health Monitoring Extension
    supabase_status = "ok"
    try:
        from app.services.supabase_client import get_supabase_client
        # Lightweight check for DB connectivity
        get_supabase_client().table("transactions").select("count", count="exact").limit(0).execute()
    except Exception as e:
        logger.warning("Supabase health check failed: %s", e)
        supabase_status = "unhealthy"

    return {
        "status": "ok" if supabase_status == "ok" else "degraded",
        "limit": MAX_GLOBAL_SESSIONS,
        "dependencies": {
            "supabase": supabase_status,
            "gemini_api": "configured" if os.getenv("GEMINI_API_KEY") or os.getenv("GCP_PROJECT_ID") else "missing"
        }
    }

async def safe_websocket_close(websocket: WebSocket, code: int, reason: str):
    """
    Safely close a WebSocket, handling the case where it's already closing or closed.

    Gemini Live WebSocket can experience race conditions where multiple code paths
    try to close the connection simultaneously. This wrapper gracefully handles the
    "Unexpected ASGI message 'websocket.close'" error that occurs when the connection
    is already closing or closed.
    """
    try:
        await websocket.close(code=code, reason=reason)
    except RuntimeError as e:
        if "Unexpected ASGI message" in str(e):
            # Connection already closing/closed — this is expected in race conditions
            logger.debug(
                "WebSocket double-close prevented: %s (code=%d, reason=%s)",
                str(e)[:100], code, reason
            )
        else:
            # Unexpected RuntimeError — re-raise
            raise

@app.websocket("/ws/agent")
async def websocket_endpoint(websocket: WebSocket, lang: str = Query("en")):
    await websocket.accept()

    try:
        init_message = await asyncio.wait_for(websocket.receive_json(), timeout=5.0)
    except asyncio.TimeoutError:
        await safe_websocket_close(websocket, code=1008, reason="Authentication timeout")
        return
    except Exception:
        await safe_websocket_close(websocket, code=1008, reason="Invalid setup message")
        return

    if not isinstance(init_message, dict) or init_message.get("type") != "setup" or not init_message.get("token"):
        await safe_websocket_close(websocket, code=1008, reason="Invalid setup format")
        return

    token = init_message["token"]
    # Language preference from client (en/es), defaults to en
    lang = init_message.get("lang", "en")
    if lang not in ("en", "es"):
        lang = "en"
    # Currency preference from client (USD/EUR/GBP), defaults to USD
    currency = init_message.get("currency", "USD")
    if currency not in ("USD", "EUR", "GBP"):
        currency = "USD"
    user_id = validate_supabase_jwt(token)
    if not user_id:
        sentry_sdk.capture_message("WebSocket auth failure: invalid token", level="warning")
        await safe_websocket_close(websocket, code=1008, reason="Invalid token")
        return

    # Phase 1, Item 3 — Connection rate limiting via Supabase
    try:
        from app.services.supabase_client import get_supabase_client
        supabase = get_supabase_client()

        # Cleanup stale sessions briefly (rpc if created)
        try:
            supabase.rpc("cleanup_stale_sessions", {}).execute()
        except Exception as e:
            logger.warning("Failed to cleanup stale sessions: %s", e)

        # Limit concurrent sessions per user — allow upsert if session is stale (>3s old)
        res = supabase.table("active_sessions").select("last_seen_at").eq("user_id", user_id).execute()
        if res.data:
            # Check age of existing session
            last_seen_str = res.data[0]["last_seen_at"]
            last_seen = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
            session_age = (datetime.now(timezone.utc) - last_seen).total_seconds()

            if session_age < 3:
                # Session is fresh — reject to prevent rapid reconnection spam
                logger.warning("Duplicate session attempt (age=%.1fs) for user %s", session_age, user_id)
                sentry_sdk.capture_message(f"Duplicate session rejected for user {user_id} (age={session_age:.1f}s)", level="warning")
                await safe_websocket_close(websocket, code=1008, reason="Session already active")
                return
            else:
                # Session is stale (>3s) — allow graceful reconnection by overwriting it
                logger.info("Stale session (age=%.1fs) being replaced for user %s", session_age, user_id)
            
        # Limit total global concurrent sessions
        count_res = supabase.table("active_sessions").select("*", count="exact").limit(0).execute()
        global_count = count_res.count if count_res.count is not None else 0
        if global_count >= MAX_GLOBAL_SESSIONS:
            logger.warning("Global session limit reached (%d)", MAX_GLOBAL_SESSIONS)
            sentry_sdk.capture_message(
                f"Global session limit reached ({global_count}/{MAX_GLOBAL_SESSIONS})",
                level="error",
            )
            await safe_websocket_close(websocket, code=1013, reason="Server busy, try again later")
            return
            
        # Register session
        supabase.table("active_sessions").upsert({
            "user_id": user_id,
            "last_seen_at": datetime.now(timezone.utc).isoformat()
        }).execute()

        # Sync profile name if it differs from JWT metadata (Session 97)
        try:
            payload = get_supabase_jwt_payload(token)
            if payload:
                metadata = payload.get("user_metadata", {})
                jwt_name = metadata.get("name") or metadata.get("full_name") or metadata.get("user_name")
                
                if jwt_name:
                    # Check current profile
                    p_res = supabase.table("profiles").select("user_name").eq("id", user_id).execute()
                    if p_res.data:
                        db_name = p_res.data[0].get("user_name")
                        if db_name != jwt_name:
                            logger.info("Syncing user_name from JWT to profile for %s: %s -> %s", user_id, db_name, jwt_name)
                            supabase.table("profiles").update({"user_name": jwt_name}).eq("id", user_id).execute()
                            # tr_propagate_profile_name_change will handle the rest
                    else:
                        # Profile doesn't exist? Create it.
                        logger.info("Creating profile for %s with name %s", user_id, jwt_name)
                        supabase.table("profiles").insert({"id": user_id, "user_id": user_id, "user_name": jwt_name}).execute()
        except Exception as _se:
            logger.warning("Failed to sync profile name during setup: %s", _se)

        # Persist user's selected language & currency into user_metrics for agent awareness
        user_name = "User"  # Default fallback
        try:
            from app.services.metrics_service import refresh_user_metrics
            # Update prefs first
            supabase.table("user_metrics").upsert(
                {
                    "user_id": user_id,
                    "selected_currency": currency,
                    "selected_language": lang,
                    "refreshed_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="user_id",
            ).execute()

            # Then perform a full metrics refresh so the agent starts with fresh data
            refresh_user_metrics(supabase, user_id)
            logger.info("Metrics refreshed for user %s during WebSocket setup", user_id)
        except Exception as _me:
            logger.warning("Failed to persist user prefs or refresh metrics during setup: %s", _me)

        # Fetch user_name from profiles table for agent personalization
        try:
            p_res = supabase.table("profiles").select("user_name").eq("id", user_id).execute()
            if p_res.data and p_res.data[0].get("user_name"):
                user_name = p_res.data[0]["user_name"]
                logger.debug("Loaded user_name for agent: %s", user_name)
        except Exception as _pe:
            logger.warning("Failed to load user_name from profiles: %s", _pe)
        
    except Exception as e:
        logger.error("Session limit check failed: %s", e)
        error_msg = str(e)
        if "23503" in error_msg and "users" in error_msg:
            # User was deleted from the database entirely
            logger.warning("Rejected connection for permanently deleted user: %s", user_id)
            await safe_websocket_close(websocket, code=1008, reason="User account deleted")
            return
        # If other DB fails, allow connection by default to avoid taking down service
        pass
    logger.info("WebSocket accepted", extra={"user_id": user_id})
    
    with sentry_sdk.new_scope() as scope:
        scope.set_user({"id": user_id})
        
        async def keepalive_auth():
            try:
                while True:
                    await asyncio.sleep(90)  # Keepalive every 90s (TTL is 3min, safe margin)
                    # Re-validate token
                    if not validate_supabase_jwt(token):
                        logger.warning("Token expired during session for user %s", user_id)
                        # Wait 30s for client to refresh token and reconnect
                        logger.info("Waiting 30s for token renewal before closing...")
                        await asyncio.sleep(30)
                        if not validate_supabase_jwt(token):
                            logger.warning("Token still invalid after retry, closing session for user %s", user_id)
                            await safe_websocket_close(websocket, code=1008, reason="Token expired")
                            break
                        else:
                            logger.info("Token refreshed, session continues for user %s", user_id)
                            continue
                        
                    # Keep session alive in Supabase
                    try:
                        from app.services.supabase_client import get_supabase_client
                        get_supabase_client().table("active_sessions").upsert({
                            "user_id": user_id,
                            "last_seen_at": datetime.now(timezone.utc).isoformat()
                        }).execute()
                    except Exception as err:
                        logger.error("Failed to keep session alive: %s", err)
                        
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error("Token validator error: %s", e)

        auth_task = asyncio.create_task(keepalive_auth())
        
        try:
            from app.agent.live_agent import LiveAgentSession
            try:
                agent_session = LiveAgentSession(websocket, user_id, language=lang, currency=currency, user_name=user_name)
                await agent_session.start()
            except ValueError as e:
                logger.error("Configuration error: %s", e, extra={"user_id": user_id})
                await safe_websocket_close(websocket, code=1011, reason="Configuration error")
        except WebSocketDisconnect:
            logger.info("Client disconnected", extra={"user_id": user_id})
        except Exception as e:
            logger.error("Unexpected error in websocket session: %s", e, extra={"user_id": user_id}, exc_info=True)
            sentry_sdk.capture_exception(e)
        finally:
            auth_task.cancel()
            
            # Remove from Supabase
            try:
                from app.services.supabase_client import get_supabase_client
                get_supabase_client().table("active_sessions").delete().eq("user_id", user_id).execute()
            except Exception as e:
                logger.error("Failed to clear session from DB: %s", e)
