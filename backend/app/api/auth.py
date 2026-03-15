import os
import time
import logging
import httpx
import jwt
import sentry_sdk
from typing import Optional

logger = logging.getLogger("finvoice.auth")

# JWKS cache with TTL
_jwks_cache: dict = {}
_jwks_fetched_at: float = 0
_JWKS_TTL = 3600  # Re-fetch every hour


def _fetch_jwks() -> dict:
    """Fetch public keys from Supabase JWKS endpoint. Returns { kid: key_data }."""
    supabase_url = os.getenv("SUPABASE_URL", "").strip('"').strip("'")
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        resp = httpx.get(jwks_url, timeout=5)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
        return {k["kid"]: k for k in keys if "kid" in k}
    except Exception as e:
        logger.warning("Failed to fetch JWKS: %s", e)
        sentry_sdk.capture_exception(e)
        return {}


def _get_jwks() -> dict:
    """Return cached JWKS, re-fetching if cache is empty or TTL expired."""
    global _jwks_cache, _jwks_fetched_at
    if not _jwks_cache or (time.time() - _jwks_fetched_at > _JWKS_TTL):
        _jwks_cache = _fetch_jwks()
        _jwks_fetched_at = time.time()
    return _jwks_cache


def validate_supabase_jwt(token: str) -> Optional[str]:
    """
    Validates a Supabase JWT and returns the user ID (sub claim).

    Supabase issues two JWT formats:
    - HS256: signed with SUPABASE_JWT_SECRET (older / email auth)
    - ES256: signed with an EC keypair, verified via JWKS endpoint (newer / OAuth)

    Returns None if the token is invalid or cannot be verified.
    """
    try:
        header = jwt.get_unverified_header(token)
    except jwt.DecodeError as e:
        logger.warning("Malformed token header: %s", e)
        return None

    alg = header.get("alg", "")

    # ─── ES256 path: verify via JWKS public key ─────────────────────────────
    if alg == "ES256":
        kid = header.get("kid")
        jwks = _get_jwks()

        if not jwks:
            # Retry once (cache may be empty after startup)
            global _jwks_cache
            _jwks_cache = {}
            jwks = _get_jwks()

        key_data = jwks.get(kid) if kid else None
        if not key_data:
            logger.warning("ES256 token has unknown kid=%s — refreshing JWKS", kid)
            # Force refresh and retry
            _jwks_cache = {}
            jwks = _get_jwks()
            key_data = jwks.get(kid) if kid else None

        if not key_data:
            logger.warning("Cannot find public key for kid=%s", kid)
            return None

        try:
            public_key = jwt.algorithms.ECAlgorithm.from_jwk(key_data)
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                options={"verify_aud": False},
            )
            return payload.get("sub")
        except jwt.ExpiredSignatureError:
            logger.warning("ES256 token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning("ES256 token invalid: %s", e)
            return None

    # ─── HS256 path: verify with JWT secret ──────────────────────────────────
    elif alg == "HS256":
        secret = os.getenv("SUPABASE_JWT_SECRET")
        if not secret:
            logger.error("SUPABASE_JWT_SECRET not set — rejecting HS256 token.")
            return None
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            return payload.get("sub")
        except jwt.ExpiredSignatureError:
            logger.warning("HS256 token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning("HS256 token invalid: %s", e)
            return None

    else:
        logger.warning("Unsupported JWT algorithm: %s", alg)
        sentry_sdk.capture_message(f"Unsupported JWT algorithm: {alg}", level="warning")
        return None
    
    return None

def get_supabase_jwt_payload(token: str) -> Optional[dict]:
    """
    Validates a Supabase JWT and returns the full decoded payload.
    Used to extract metadata like email or names.
    """
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "")
        
        if alg == "ES256":
            jwks = _get_jwks()
            kid = header.get("kid")
            key_data = jwks.get(kid) if kid else None
            if not key_data:
                return None
            public_key = jwt.algorithms.ECAlgorithm.from_jwk(key_data)
            return jwt.decode(token, public_key, algorithms=["ES256"], options={"verify_aud": False})
            
        elif alg == "HS256":
            secret = os.getenv("SUPABASE_JWT_SECRET")
            if not secret:
                return None
            return jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
            
    except Exception as e:
        logger.error("Failed to decode JWT payload: %s", e)
        return None
    
    return None
