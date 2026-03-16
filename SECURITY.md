# Security & Privacy

## Reporting a Vulnerability

Found a security issue? Email `5anik4h@gmail.com` with:

- What you found
- Steps to reproduce (if applicable)
- Why it matters

I'll respond within a few days and fix critical issues ASAP.

## What I Do

✅ **Voice security** — Your audio is streamed over HTTPS (encrypted in transit)
✅ **JWT authentication** — Sent via WebSocket (not URL), preventing token leaks
✅ **Row-level security** — Supabase RLS filters all queries by your user_id
✅ **No password storage** — Magic links + Google OAuth only
✅ **Validate all input** — Both on frontend (UX) and backend (security)
✅ **Monitor errors** — Sentry tracks bugs and security issues
✅ **Keep dependencies updated** — Regular checks for vulnerabilities

## What You Should Do

1. **Guard your magic link** — Treat email login links like passwords, don't share them
2. **Secure your email** — It's your only login method; use strong recovery options
3. **Verify amounts before sending** — Check twice before confirming voice input
4. **Don't store secrets in exports** — Downloaded data is unencrypted (export responsibly)
5. **Report suspicious activity** — If something feels wrong, email me immediately

## What I Can't Guarantee

- **100% uptime** — Cloud services have occasional outages (rare, but happens)
- **Protection from all hacks** — I try hard, but no system is 100% safe
- **Access if you lose your email** — If you lose email access, you lose login ability
- **Accuracy of AI insights** — Verify important decisions independently

## Financial Data Privacy

Your data:

- **Stored encrypted** in Supabase (on Google Cloud servers)
- **Only accessible** with your email/Google login
- **Never shared** with third parties
- **Can be deleted** anytime (right to deletion, GDPR-compliant)

## Voice & Image Privacy

- **Voice audio** — Processed by Google Gemini Live API (transcribed, then audio discarded)
- **Receipts/images** — Analyzed by AI, stored only if you create a transaction
- **Conversation memory** — Last 6 conversation turns stored temporarily; cleared after 30 minutes

## Known Limitations

Finrush is a **tracking tool**, not a bank. It:

- ✅ Tracks your transactions, investments, budgets
- ✅ Uses Gemini AI for natural language understanding
- ❌ Does NOT execute trades or transfers
- ❌ Does NOT provide professional financial advice
- ❌ Does NOT guarantee protection from all security threats

## Session Security

- **Active session limit** — Only one WebSocket session per user (prevents multi-device exploit)
- **Session timeout** — Automatic logout after inactivity
- **JWT expiry** — Tokens valid for specific periods; re-authentication required if expired
- **HTTPS only** — All connections encrypted (no unencrypted HTTP)
