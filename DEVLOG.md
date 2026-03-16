# Finrush — Development Log

> Chronological record of Finrush's development, from early versions to production.
> Covers architectural decisions, bug fixes, features shipped, and lessons learned.

---

## March 16, 2026

### Investment form data integrity audit

**Goal**: Audit the full separation of buy price vs. current price, fix any bugs found.

A 7-layer system audit was performed (frontend forms, data transformations, backend services, database schema, agent documentation). Result: 70% was correctly implemented, but 2 critical bugs were identified.

**Bug 1 — Historical buy price overwritten (Critical)**

In auto mode, if the user didn't fill in the buy price, the code replaced it with the live market price fetched in real time. This destroyed the original historical purchase price.

Example: user says "I bought AAPL at $150". The system fetched the current price ($190) and saved it as the buy price. Result: P&L calculations were wrong.

The fix explicitly separates both fields: buy price comes only from user input, never from the market. Current price can be updated with live data.

**Bug 2 — Funds missing buy price in USD (Medium)**

When creating a fund by specifying total amount but no unit price, the system didn't derive the price or compute its USD equivalent. Dual-currency storage was left incomplete.

The fix: if the user provides quantity and total but no unit price, the system derives it automatically (`buy_price = total / quantity`) before computing the USD equivalent.

---

## March 15, 2026

### Public repository + documentation sync

**Goal**: Publish clean code to a public repository and sync documentation.

The public repository was created with a curated set of files: backend and frontend source code, environment variable example files, README, and license. CI/CD configuration, internal tests, migration scripts, and internal documentation were excluded.

Documentation was updated to reflect the current state: 29 agent tools, 10 investment types.

---

### Production audit + 2 critical bugs

**Goal**: Audit the production system and fix issues found.

**Bug 1 — Duplicate responses on multi-tool turns**

When the agent executed multiple tools in a single conversation turn (e.g. save + get balance), the response text was sent multiple times to the user.

Root cause: the Gemini Live API fires `turn_complete` after **every tool-response cycle**, not just at the end of the turn. The previous code flushed the transcript buffer on every `turn_complete`.

Fix: added an `_awaiting_tool_response` flag. When `turn_complete` arrives while that flag is active, the flush is skipped (intermediate turn). The text is only sent when `turn_complete` arrives with the flag inactive (final turn).

**Bug 2 — WebSocket double-close**

In 0.5% of connections, a `RuntimeError` occurred when trying to close a WebSocket that was already closed. Multiple exception handlers could reach the same `websocket.close()` call simultaneously.

Fix: a `safe_websocket_close()` wrapper that silently catches the specific double-close error, without masking other runtime errors.

System metrics after fixes: availability 95/100, security 94/100, code quality 88/100.

---

### Investment system normalization (10 tables)

**Goal**: Unify the schema across all 10 investment tables with consistent field names.

Before this session, the schema was heterogeneous: each asset type used different field names for equivalent concepts. The normalization unified:

- **Group A** (stocks, crypto, ETFs, commodities): unified `quantity` field (previously `shares` in ETFs), removed platform and type-specific identifiers.
- **Group B** (fixed income, savings accounts, crowdlending): `quantity` for principal capital (previously `principal` or `capital`), `apy` for annual rate (previously `interest_rate`), added `name` column.
- **Funds**: added quantity and buy price fields, removed type and manager fields.
- **Forex**: simplified to name, quantity, and currency.
- **Real estate**: added rent start date. Real estate does not generate automatic transfer transactions on add/sell (unlike all other asset types).

Backend, frontend, and agent documentation were updated in parallel.

---

### Proactive image vision

**Goal**: The agent should analyze images automatically without waiting to be asked.

Previously, if a user sent a photo of a receipt, the agent would wait for instructions. With this change, the agent immediately analyzes any financial image and acts:

- Receipts and invoices → creates the transaction automatically.
- Price screenshots → extracts price and currency, offers to log it.
- Bank statements → summarizes trends and categories.

The agent always reports what it did: "I've added your €45.32 expense at 2:15 PM". It only asks if there is genuine ambiguity (illegible amount, completely undetermined category). Otherwise it makes intelligent assumptions.

Implemented as a new section of the system prompt in both supported languages (English and Spanish).

---

### System prompt restructuring (8 blocks)

**Goal**: Rewrite the agent prompt from 9 loosely organized tiers to 8 blocks with a natural logical flow.

The previous prompt had personality instructions buried after 200 lines of rules. The restructuring starts from how the agent should "think" when starting a session:

| Block | Content |
|-------|---------|
| BLOCK 0 | Language, currency, and user identity (absolute session lock) |
| BLOCK 1 | Personality, voice, empathy, 3 conversational modes |
| BLOCK 2 | Data rules (never invent, dates, currency flow) |
| BLOCK 3 | Available tools with a selection guide |
| BLOCK 4 | Execution protocol (confirmation, anti-loop, error handling) |
| BLOCK 5 | Operational domains (transactions, budgets, savings, investments) |
| BLOCK 6 | Strategic advisory (when and how to offer analysis) |
| BLOCK 7 | Limits and privacy |

The three conversational modes (RESOLUTIVE, CONVERSATIONAL, FAREWELL) let the agent adapt its style to context: execute tasks concisely, offer follow-up suggestions, or close the session warmly.

A tool deduplication cache was also implemented: if the agent tries to execute the same mutation twice within 30 seconds for the same user, the second call is silently discarded.

---

### Security: rate limiting + GDPR compliance

**Goal**: Protect the market price endpoint and complete the account deletion flow.

**Rate limiting on the price endpoint**: A sliding window limiter was implemented (30 requests per 60 seconds per IP). Uses the `X-Forwarded-For` header to get the real IP in proxy environments. Returns HTTP 429 if the limit is exceeded. The goal is to protect the server's IP address from being blocked by market data providers.

**GDPR-compliant account deletion**: The deletion cycle was completed. Previously, the cleanup function deleted application data but not the authentication record, allowing users to log back in even after requesting deletion. The process is now: (1) delete all data from application tables, (2) mark the deletion request as completed in the audit table, (3) delete the authentication record. The order matters: if step 3 fails, the audit record stays with status "completed" to prevent reprocessing.

---

### Secret rotation and security documentation

**Goal**: Establish a rotation schedule for project credentials.

A credential inventory was compiled, classified by sensitivity (critical, high, low), with specific rotation procedures for each provider. Documented in the architecture reference as an active security policy.

---

### Personalization + 3 UX bugs + documentation consolidation

**Goal**: Agent addresses users by name, fix visual bugs, simplify documentation.

**Personalization**: When the WebSocket session starts, the backend queries the user's name from the database and injects it into the prompt context. The agent can address the user by first name. Falls back to a generic greeting if the profile is incomplete.

**Bug 1 — "Goal" field required in savings pots**: The form allowed creating a pot without a target amount, causing inconsistencies in progress calculations. Made mandatory.

**Bug 2 — Negative sign lost in currency formatting**: The `fmtCurrency()` function was dropping the negative sign for amounts less than zero. Fixed.

**Bug 3 — Current month in balance dashboard**: The month selector loaded the previous month by default. Fixed to show the current month.

**Documentation consolidation**: Documentation reduced from 10+ files to 5 core documents in the repository root: agent rules, architecture, design system, deployment log, and public README.

---

## March 14, 2026

### Backend linting fix

An unused import in the tool handler was causing a linting error that blocked deployment. The imported argument was integrated into the actual validation logic of the corresponding tool, resolving both the linting error and improving consistency with the rest of the validation pattern.

---

### Agent connection fix + short IDs for goals

**Goal**: Fix an import error preventing the agent from using search tools, and introduce short numeric IDs for budgets and savings pots.

**Import fix**: A Pydantic model wasn't correctly exported in the models module. The agent reported "technical issues" when trying to execute searches because the server failed to load the module.

**Short IDs**: UUIDs are difficult to use in voice interactions. `short_id` columns with auto-incrementing numeric sequences were added to the budgets and savings pots tables. This enables references like "pot number 3" or "budget 7" instead of long identifiers.

**Metrics fix**: Progress charts were using the UUID as the period key, causing database errors (column too short). Fixed to use `short_id`.

---

### ID consistency and agent communication improvements

**Goal**: Agent prioritizes names over IDs; normalize history table columns.

The agent now uses the budget or pot name first in its responses, reserving `short_id` as an internal fallback when there's ambiguity between records with similar names.

History table columns were renamed to follow the `short_id` convention used across the rest of the schema, and the corresponding SQL archiving functions were updated.

UX improvements: scale animation on the record button, responsiveness fixes in the settings menu, and full localization of texts that were hardcoded in one language.

---

## March 13, 2026

### Observability and automated tests (P3-P5)

**Goal**: Complete the monitoring improvements identified in the previous audit.

**Sentry error capture**: Errors in the thread pool that computes metrics weren't reaching Sentry because exception handlers were using `logger.warning()` instead of explicit capture. Fixed.

**Health monitoring**: Metrics updates now log latency in milliseconds and the number of chart rows computed. This makes it possible to detect performance degradation or missing data before it affects users.

**Automated tests**: A regression test suite was created for monthly snapshot generation. The tests validate that the `is_active` filter bug doesn't reappear and that net worth calculations include all savings pots.

---

### Critical audit: 2 bugs + metrics cooldown

**Goal**: Full audit of production logs, immediate bug fixes.

**Bug 1 — Monthly snapshots failing for all users**: The snapshot service was filtering savings pots by an `is_active` column that doesn't exist in the schema. Result: the snapshots table was empty and the net worth evolution charts showed no historical data.

**Bug 2 — Silent metrics refresh**: The metrics refresh ran using `logger.debug()` and `logger.warning()`, log levels too low to appear in cloud logs. It was impossible to know if metrics were computing correctly or failing silently. Log level raised to `info` and `error` with full stack traces.

**Metrics cooldown**: A 20-second throttle per user was implemented to prevent multiple concurrent frontend requests from triggering metric recomputation N times in parallel.

---

### UI cleanup

Two small interface improvements: removed the duplicated lime-colored amount from savings pot cards, and removed monetary amounts from the wealth distribution chart legend (now shows only percentages).

---

### Homogeneous multi-currency investments + robust price updates

**Goal**: Extend dual-currency storage to Group A (tradeable assets) and add fallbacks for market price updates.

Until this point, only Group B/C assets (funds, real estate, crowdlending, forex) stored their purchase price in the original currency plus a frozen USD equivalent. Tradeable assets (stocks, crypto, ETFs, commodities) always assumed USD prices.

With this change, a user can register "10 Inditex shares at €47" and the system stores: original price = 47 EUR, USD equivalent = ~50.76 USD (computed using the exchange rate at the time of purchase, frozen). P&L calculations and charts always use the USD equivalent for consistency.

**3-tier price update fallback system**:
- **Plan A**: Yahoo Finance, with User-Agent rotation and retry on 429 errors.
- **Plan B**: Finnhub (financial markets API), activated when Yahoo blocks the server IP.
- **Plan C**: The agent itself performs a Google Search for the price and updates it via tool call.

The `update_all_investment_prices` response now includes which tickers updated successfully and which failed, allowing the agent to apply Plan C specifically for failures.

---

### Currency architecture audit

**Goal**: Full review of the currency logic after previous work left inconsistencies.

9 files were audited. Key changes:

- The `update_exchange_rates` tool was removed from the agent's toolset. Exchange rates are now only managed by the operator directly in the database. This prevents the agent from modifying data that affects all financial calculations system-wide.
- `normalize_investment()` was completed for all 10 asset types: all now return `invested_amount_usd`, `current_value_usd`, and `pnl_usd` in a consistent format.
- The frontend was fixed to read `*_usd` fields for Group B/C assets, ensuring conversion to the display currency is correct.
- The agent's system prompt documentation was updated to clearly explain that `rate_at_entry` is immutable per record: future rate changes don't retroactively affect historical data.

---

## March 12, 2026

### Overlapping dropdowns fix

Only one dropdown menu can be open at a time in the transactions and investments tables. A `useExclusiveDropdown` hook was implemented and applied to both tables.

A `user_name` column was also added to the metrics tables, with sync triggers so any profile name change propagates automatically.

The `get_all_categories` tool was also fixed: the agent now receives friendly category names ("Bills", "Home") instead of their technical identifiers.

---

### Landing page and legal compliance

**Goal**: Redesign the landing page and add legal pages.

The landing page was expanded with a 5-step "How it works" section, a grid of 8 key features, a privacy section explaining security measures, and updated FAQs.

Privacy Policy, Terms of Use, and Cookies pages were added, along with a cookie consent banner integrated into the marketing layout.

---

### Dual-currency storage architecture (Xero/QuickBooks pattern)

**Goal**: Implement dual-currency storage for all monetary amounts in the system.

This was the largest structural database change to date: every monetary amount is stored as four fields:
- `amount`: original amount in the user's currency (source of truth, immutable).
- `currency`: 3-letter code.
- `amount_usd`: USD equivalent computed at save time (frozen for historical accuracy).
- `rate_at_entry`: exchange rate used at the time of entry.

**Why this design**: eliminates double conversions with precision loss, lets the agent see "100 EUR" when the user says "100 euros" (without converting mentally), and ensures P&L history is accurate regardless of how rates change in the future.

New columns added to: transactions, budgets, savings pots, contributions, and all investment tables (funds, crowdlending, real estate, forex).

All currency conversion logic was removed from the frontend. Forms now pass `amount` and `currency` directly to the backend, which resolves the conversion. The frontend only converts for display purposes (USD → display currency).

17 files modified. All validations clean.

---

## March 11, 2026

### Investment module overhaul

**Goal**: 4 improvement blocks for the investment module.

**Block 1 — Quick fixes**:
- Price update cooldown was freezing at 59 seconds when switching tabs.
- Asset types with zero value weren't appearing in the distribution chart.
- The "Delete" button is now red (destructive color, previously amber).
- Payment frequency in Group B now defaults to "monthly" on create.

**Block 2 — Currency architecture redesign**: The currency selector in forms is purely informational during editing. Conversion only happens at save time, not in real time while the user types. This eliminates value jumps in fields during editing.

**Block 3 — Form unification**: Mutual exclusion between "Quantity" and "Total amount" fields (only one can be filled). Bilingual frequency option labels. Currency selector in the transaction edit form.

**Block 4 — Agent tool expansion**: The `update_investment` tool now supports 14 additional fields covering all asset types (ETFs, funds, crowdlending, real estate, forex).

---

## March 8, 2026

### Language lock + mid-session language change protocol

**Goal**: Agent speaks only in the configured language; users can change language without reconnecting.

**Language lock**: A "Session Lock" was added as the first block of the system prompt. The agent cannot switch languages, offer translations, or respond in a different language than the one configured, even if the user speaks to it in another language. In that case, it responds in the configured language and indicates how to change the selector in the app.

**Data sync mandate**: The agent must query real tools before declaring any amount. It cannot invent or estimate figures.

**Mid-session language change without reconnection**: If the user changes the selector during an active session, the frontend sends a `{type: "language_change", lang: "es"}` message over WebSocket. The backend updates its internal language state and sends a context message to Gemini. The change takes effect on the next turn without interrupting the conversation.

---

## March 7, 2026

### Sentry audit and documentation cleanup

A full Sentry audit was performed (0 unresolved issues). The 5 critical frontend error capture points were identified and documented. False positive configuration was fixed: normal Gemini connection closures (code 1000, expected GoAway after inactivity) no longer get reported to Sentry as errors.

Documentation was consolidated by removing duplications between files, keeping only critical rules in the agent reference document.

---

### Development standards and architecture guidelines

`AGENT_GUIDELINES.md` was created (580 lines) with the complete development manual: modular architecture, security, pre-push checklist, step-by-step workflows, and a table of common mistakes.

Three golden rules established for all contributors:
1. Code is written in English (variables, functions, comments, commits).
2. All database queries include a `user_id` filter without exception.
3. The deployment log is updated after every task.

---

### English rename + documentation cleanup

Main dashboard components were renamed to English (`ResumenTab` → `SummaryTab`, `ObjetivosTab` → `GoalsTab`, `InversionTab` → `InvestmentsTab`). 8 obsolete documentation files were deleted. `ARCHITECTURE.md` was fully rewritten to reflect the current project state.

---

### SVG visual identity

The icon and logo were migrated to SVG vectors as the single source of truth. Static PNGs were removed. The horizontal logotype ("Fin" in foreground + "rush" in lime) was created in SVG and integrated into the landing page, dashboard, and login screen.

---

## March 5, 2026

### UI/UX refinements and agent flexibility

Fixes to the market price sync so an invalid ticker no longer interrupts the update for all others. The agent now extracts the currency when the user mentions it explicitly, rather than always defaulting to USD.

In the investment module: removed the empty state with promotional text (the view now starts with a clean structure). The price update button cooldown now persists in `sessionStorage` so it doesn't reset when switching tabs.

---

### Financial precision and centralized currency conversion

**Goal**: Fix rounding errors and centralize conversion logic in the backend.

All monetary columns were migrated from `FLOAT` to `NUMERIC(18,6)` to eliminate rounding errors inherent to floating-point arithmetic (example: €1,800 → €1,799.97).

A `convert_to_usd` function was implemented in the backend. All agent tools now accept an optional `currency` parameter. The system prompt includes a strict directive: the agent must not perform currency math on its own; it should pass the user's exact amount and currency.

---

### Robustness and critical error handling

Two robustness fixes:

**Deleted users with active sessions**: When a user is deleted from authentication but their JWT is still valid, database operations fail with a foreign key error. The system now detects this and closes the WebSocket session with a descriptive message.

**February date bug**: Snapshot generation for February was using day "31" as the last day of the month, causing a "date out of range" error. Fixed with dynamic last-day calculation using Python's `calendar` module.

A rule was also added to the system prompt so the agent never reveals technical details (PostgreSQL error codes, table names, internal exceptions) to the user.

---

### User lifecycle and name synchronization

**Goal**: Automate the account deletion process with a grace period, and sync the user name across the entire system.

The `profiles` table was created as the source of truth for the user's name, linked to authentication. A `user_name` column was added to 15 tables, and cascade triggers were implemented to propagate name changes retroactively.

The account deletion process now uses a scheduled job running at midnight. If the user logs in before the grace period expires (30 days), the request is automatically canceled and the account is restored.

---

### Agent audit, RLS, and visual refinements

**Goal**: Security audit, database cleanup, and chart improvements.

Row Level Security activated on data tables. Orphaned tables removed. Defenses against agent manipulation attempts added to the system prompt.

Code cleanup: removed all unused variables, imports, and types across dashboard components.

New charts in the investment module: daily P&L evolution and a bar chart of the 8 asset types. ETF rendering fix in the distribution chart.

---

### Chart refinements (second round)

Unified tick format across all dashboard charts: values below 10,000 show with thousands separator; larger values are abbreviated with a "k" suffix. Negative values use the Unicode minus (−) for better typography.

Symmetric domain in the monthly savings chart: the Y axis always shows zero centered, with equal positive and negative amplitude.

---

### Dashboard chart improvements

New visualizations: category icons on the X axis of the Balance chart, P&L by investment as time series lines instead of bars, and "Monthly Savings" chart showing net amount (contributions − withdrawals) with conditionally colored bars (lime = positive, amber = negative).

---

### Mobile UX improvements and investment logic

Mobile layout adapted in Balance: total takes full width with income and expenses in columns below. Reciprocal calculation logic in investments: if quantity or price is missing, it's derived using the market price.

---

### Audit, cleanup, and merge to main

Obsolete components removed (previous `MovimientosTab`, `PresupuestosTab`), old standalone landing, and build cache. Documentation updated to reflect the current system state.

---

## March 4, 2026

### Full improvement plan (PHASE 0-7): system redesign

This session implemented the largest set of changes in the project to date: 8 investment tables, savings pots, corrected net worth calculation, new agent tools, tab redesign, and monthly snapshots.

**Database**: Tables created for `savings_pots`, `savings_contributions`, the 8 investment tables (`inv_stocks`, `inv_crypto`, `inv_etfs`, `inv_funds`, `inv_crowdlending`, `inv_realestate`, `inv_commodities`, `inv_forex`), exchange rates, and monthly snapshots. Data from the old single investment table was migrated to the 8 new ones.

**Net worth math fix**: Previously, the savings calculation used `balance * 0.3` as an approximation. Now: `NET WORTH = BALANCE + INVESTMENTS + SAVINGS`, where each component comes from its real data.

**Savings pots**: 6 new agent tools (create, read, update, delete, deposit, withdraw). Deposits automatically create a `savings_contribution` expense transaction and withdrawals create a `savings_withdrawal` income transaction. This keeps the balance always correct.

**Redesigned investment module**: The backend routes operations to the 8 specific tables by asset type. The frontend has pill navigation (All + 8 types), type-specific table columns, and adaptive forms per asset type.

**Monthly snapshots**: An endpoint generates and stores the wealth state for any given month. The net worth evolution chart reads snapshots for closed months and calculates in real time for the current month.

**Agent tools**: from 17 to 25 (+6 savings pot tools, `get_market_price`, `get_all_categories`).

**Automatic transfer rules**:
- `add_investment` → generates `investment_transfer` expense (except real estate).
- `sell_investment` → generates `investment_return` income (except real estate).
- `add_savings_contribution` → generates `savings_contribution` expense.
- `withdraw_from_savings` → generates `savings_withdrawal` income.
- These categories must never be created manually.

---

## March 2, 2026

### Professional multi-currency system

**Goal**: Implement a currency selector (USD/EUR/GBP) with React Context and live exchange rates.

`CurrencyContext` was created — a centralized React context managing the display currency and exchange rates. All dashboard components use the `useCurrency()` hook without prop drilling.

Formatting is locale-aware: EUR uses German locale (1.200,00 €), USD and GBP use American locale ($1,200.00 / £1,200.00).

A new backend endpoint fetches exchange rates from a public source with an 8-second timeout and fallback rates in case of error.

---

### Language enforcement for stored data

The agent writes descriptions, notes, and names in the user's configured language, not the system language. If the user has Spanish configured, data is stored in Spanish.

---

## March 1, 2026

### Gemini Live API reliability improvements

**Goal**: Stable voice sessions for long conversations (more than 15 minutes).

The Gemini Live API has a context limit of ~128k tokens. An active voice session consumes this limit in 10-15 minutes.

**Session Resumption**: On reconnect, the resumption token captured from the previous session is sent, recovering the conversational context.

**Context window compression**: Sliding window enabled with trigger at 100,000 tokens. The system compresses old context automatically, enabling sessions lasting hours.

**GoAway handling**: When the server signals it's about to disconnect (GoAway message), the frontend is notified with the remaining time.

**Memory optimization**: Previous turns stored in the prompt are truncated to 300 characters to prevent uncontrolled context growth.

**Smart data refresh**: The dashboard only reloads data when a database operation completes successfully, not on every tool call.

---

### UI/UX: decimals, real-time refresh, and button layout

5 UX issues fixed:
- Amounts missing decimals (`8000` instead of `8,000.00`).
- Budgets and Investments not updating when the agent made changes.
- "Cancel/Save" buttons stacked vertically on mobile.
- Budget end date blocked saving even though it was optional.
- The investment table refresh button also refreshed the KPI cards (unintended behavior).

The last issue uses a dual-state pattern: `kpiInvestments` (only updated via agent signals) and `investments` (updated by the manual button).

---

### Agent tools audit + UX polish

Gemini was attempting to call `update_budget` and `update_investment` — tools implemented on the server but not declared in the Gemini SDK setup. This caused disconnections with code 1007. They were properly declared.

Normal Gemini connection closes (code 1000, GoAway after inactivity) were being treated as errors and reaching Sentry. Fixed to log as INFO.

Typography standardized across all 5 dashboard tabs: font sizes, weights, and classes unified.

---

## February 28, 2026

### Robust sessions and automatic recovery

**Goal**: Fix the "duplicate session" error that affected users when reloading the page.

**Root cause**: Keepalive was sent every 5 minutes, but the automatic session cleanup in the database had a 2-minute TTL. There was a 3-minute window where the session became orphaned.

**4 surgical changes**:
1. Keepalive reduced from 300s to 90s. Session TTL increased to 3 minutes.
2. Upsert logic: if the existing session is more than 10 seconds old, reconnection is allowed (orphaned session). If less, it's rejected (anti-spam protection).
3. 30-second retry when the JWT token expires during a long session, giving the client time to renew it.
4. The frontend distinguishes recoverable errors (silently reconnects after 2 seconds) from permanent errors (shows a message to the user).

---

## Early sessions

### Investment refinements and wealth distribution charts

The investment system allows specifying asset quantity, total amount, or both. If a value is missing, the backend derives it using the market price. The wealth distribution chart was improved with interaction disabled to avoid unexpected behavior on mobile.

---

### Foundation and initial infrastructure

The first sessions built the core infrastructure:

- Gemini Live API integration for real-time audio processing.
- Audio pipeline: Web Audio API (AudioWorklet, 16kHz PCM) → WebSocket → backend → Gemini → audio response.
- Authentication with Supabase (magic link + Google OAuth).
- WebSocket session management with database tracking to support multiple backend instances.
- The 5 dashboard tabs: Summary (net worth), Balance (transactions), Goals (budgets), Investments, Savings.
- Closed category system with icons for transactions and investments.
- Glassmorphism design: dark palette with lime (#C8FF00) accent and dark green background.
- Deployment on Google Cloud Run with GitHub Actions.

---

## Technical notes

### On the Gemini Live API

The correct model name for the Live API is `gemini-live-2.5-flash-native-audio`. Alternative names break the WebSocket connection with error 1007.

The API fires `turn_complete` after **every tool-response cycle**, not just at the end of the turn. Any code that reacts to this event must distinguish whether it's an intermediate turn (tools still pending) or the final turn.

### On the dual-currency architecture

Every monetary record stores four fields: original amount, original currency, USD equivalent (frozen at the time of entry), and the rate used for the calculation. The `rate_at_entry` field is immutable: future rate changes don't affect historical data. The frontend never does currency arithmetic; it only converts USD → display currency for rendering.

### On the investment architecture

The backend routes to 10 tables by asset type. The `normalize_investment()` function unifies the output of all tables to a common format. Tradeable assets (Group A) support market price updates via a proxy service; others do not.

---

*Development log maintained during Finrush's build, 2026.*
