# Finrush 🎤💰

<div align="center">

[![Status: Production](https://img.shields.io/badge/status-production-green?style=flat-square)](https://finvoice.me4dows.com)
[![Build: Passing](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](https://github.com/5anik4h/cloud_agent/actions)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-5.3-blue?logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/python-3.12-blue?logo=python&style=flat-square)](https://www.python.org/)

**Your AI Financial Assistant Powered by Gemini Live API**

[🌐 Live Demo](https://finvoice.me4dows.com) • [📐 Architecture](ARCHITECTURE.md) • [📋 Agents Guide](AGENTS.md) • [🎨 Design System](DESIGN.md)

</div>

---

## 📖 What is Finrush?

**Stop wrestling with spreadsheets. Start talking to your money.**

Finrush is the voice-first, AI-powered personal finance assistant that makes keeping your finances up-to-date effortless. Just speak naturally—add transactions, ask questions about your net worth, set budgets, track investments. Our advanced AI handles the rest: categorization, calculations, organization, real-time insights.

### The Problem It Solves
- 📊 **Manual data entry hell**: Typing each transaction is tedious and error-prone
- 🗂️ **Spreadsheet chaos**: Multiple files, outdated data, no insights
- 💡 **No financial clarity**: Can't see your full picture without deep analysis
- 📱 **Complex apps**: Clicking through 10+ screens to log a simple expense

### The Solution: Finrush
Just **talk**. That's it.

---

## ✨ Key Features

### 🎤 Voice-First Experience
- Real-time PCM audio streaming (16kHz) via Web Audio API
- Natural language understanding via Google's Gemini Live API
- Speak any way you want — conversational, abbreviated, even in Spanish
- Instant confirmation and feedback

### 🤖 Intelligent Processing
- Powered by **Google Gemini Live API** — understands context, multi-turn conversations
- Automatic transaction categorization (Income, Expenses, Investments, Savings)
- Complex investment parsing (stocks, crypto, ETFs, real estate, P2P lending, etc.)
- Smart clarification when things are ambiguous

### 📊 Comprehensive Dashboard
**5 interactive tabs** covering your entire financial life:
1. **Summary** — Net worth at a glance + wealth evolution chart + portfolio breakdown
2. **Balance** — Transactions history + 6 KPI cards (balance, income, expenses, savings)
3. **Goals** — Budget management with progress tracking + Savings pots with flexible targets
4. **Investments** — 8-type portfolio: stocks, crypto, ETFs, funds, crowdlending, real estate, commodities, forex
5. **Savings** — Contribution analysis, accumulated balance trends, savings rate tracking

### 💱 Multi-Currency Support (Intelligent Dual-Storage)
- Switch seamlessly between **USD ($)**, **EUR (€)**, and **GBP (£)**
- Every amount stored in **original currency + USD equivalent + frozen exchange rate**
- Backend-driven conversion eliminates precision loss and agent confusion
- Accurate historical P&L calculations regardless of currency switches

### 🌍 Bilingual Context
- Full **English** and **Spanish** support
- Persistent language preference (remembers your choice)
- Agent responds in your selected language, never code-switching

### 🎨 Premium Dark UI
- Stunning **glassmorphism design** with dark green & lime accent palette
- Reactive WebGL orb animation responding to voice input
- Smooth Framer Motion transitions
- Dark mode optimized for evening use, reduces eye strain

### 🔐 Privacy-First & Secure
- **Row-Level Security (RLS)** — Every query filtered by user_id
- **AES-256 encryption** for data at rest
- **Strict JWT validation** with 90-second re-validation
- **Character-masked logging** — never logs financial amounts or sensitive data
- **Audio data not retained** for model training
- Open source — audit the code yourself

### 📈 Advanced Portfolio Management
- **Polymorphic investment system** supporting 8 asset types with dedicated tables
- **Live market prices** — Yahoo Finance integration with Finnhub fallback
- **Normalized P&L tracking** — consistent calculations across currency/asset type boundaries
- **Monthly net worth snapshots** — track your wealth evolution over time
- **Investment history** — every transaction frozen with its entry rate for accurate reporting

---

## 🚀 Get Started in 2 Minutes

### Option 1: Live Demo (Fastest)
Experience Finrush right now with zero setup:
👉 **[finvoice.me4dows.com](https://finvoice.me4dows.com)**

1. Click "Sign In"
2. Use **Magic Link** (check your email) or **Google OAuth**
3. Click the microphone and say: *"I just spent $45 on groceries"*
4. Watch the dashboard update in real-time

### Option 2: Local Development (5 min setup)

**Requirements**: Node.js 20+, Python 3.12+

```bash
# Clone repository
git clone https://github.com/5anik4h/cloud_agent.git
cd cloud_agent

# Frontend setup
cd frontend
npm install
npm run dev          # Runs on http://localhost:3000

# Backend setup (in another terminal)
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload  # Runs on http://localhost:8000
```

**Configuration**:
- Copy `.env.example` to `.env` (both frontend and backend)
- Add your Supabase credentials + Google Cloud API key
- Start talking 🎤

---

## 💡 How It Works (30-second version)

```
You speak 🎤
    ↓
Audio captured by browser (Web Audio API)
    ↓
Sent to backend via secure WebSocket
    ↓
Processed by Gemini Live API
    ↓
AI understands intent + calls financial tools
    ↓
Backend queries Supabase (your secure database)
    ↓
Dashboard updates in real-time
    ↓
Audio response streamed back to you
    ↓
You hear confirmation 🔊
```

---

## 🏗️ Technical Architecture

Finrush is built with a **modern, scalable stack**:

### Frontend
- **Next.js 16** (React 19) — Server-side rendering, optimized bundle
- **Tailwind CSS v4** + **shadcn/ui** — Professional, accessible components
- **Web Audio API** — 16kHz PCM capture via AudioWorklet
- **WebSocket** — Low-latency bidirectional streaming
- **Framer Motion** + **Three.js** — Smooth animations + WebGL orb

### Backend
- **FastAPI** — Async Python, WebSocket support, automatic API docs
- **Gemini Live API** — Real-time multimodal AI with tool calling
- **Supabase PostgreSQL** — Encrypted database with row-level security
- **ThreadPoolExecutor** — Non-blocking database queries

### Infrastructure
- **Google Cloud Run** — Serverless containers, auto-scaling
- **Cloudflare DNS** — Global CDN, DDoS protection
- **GitHub Actions** — Automated testing + deployment pipeline
- **Sentry** — Real-time error tracking + performance monitoring

For a deep dive: **[Read ARCHITECTURE.md](ARCHITECTURE.md)**

---

## 📚 Documentation for Developers

New to Finrush? Read in this order:

1. **[AGENTS.md](AGENTS.md)** (5 min)
   - 7 critical rules for contributors
   - Code quality standards
   - Pre-push checklist

2. **[ARCHITECTURE.md](ARCHITECTURE.md)** (15 min)
   - System design, tech stack, databases
   - API endpoints, WebSocket flow
   - File locations and module structure

3. **[DESIGN.md](DESIGN.md)** (10 min)
   - Color system and CSS variables
   - Typography, component patterns
   - When and when NOT to hardcode styles

4. **[DEPLOYMENT_LOG.md](DEPLOYMENT_LOG.md)** (reference)
   - Chronological history of all sessions
   - What changed, why, and how to verify

---

## 🔒 Security & Privacy

### Your Data is Safe
- ✅ **Encrypted at rest** — AES-256 in Supabase
- ✅ **Encrypted in transit** — HTTPS + secure WebSocket (WSS)
- ✅ **Row-level security** — Users can only see their own data
- ✅ **No data harvesting** — Audio/text never used to train public models
- ✅ **Open source** — Audit the code, verify security yourself

### Disclaimer
**Finrush is NOT financial advice.** It's an organizational tool that helps you track and understand your money.

- 🔴 **NOT**: Tax advice, investment recommendations, legal guidance
- 🟢 **IS**: Personal finance tracking, budget management, net worth monitoring

Always verify calculations and consult a professional for major financial decisions.

---

## 🤝 Contributing

We welcome contributions! Follow these steps:

### 1. Read the Guidelines
```bash
# Must read before any code changes
cat AGENTS.md              # 5 critical rules
cat ARCHITECTURE.md        # System design
cat DESIGN.md              # UI/UX standards
```

### 2. Local Pre-Push Checklist
```bash
# Frontend validation
cd frontend
npm run lint              # ESLint (0 errors required)
npx tsc --noEmit         # TypeScript (0 errors required)

# Backend validation
cd backend
ruff check app/          # Python linting (0 errors required)
```

### 3. Commit & Document
```bash
git add .
git commit -m "feat: your feature description"
# Update DEPLOYMENT_LOG.md with what you changed
git push origin main
```

GitHub Actions will:
- Run linting and type checks
- Build Docker images
- Deploy to Cloud Run (if all checks pass)

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| **Frontend** | Next.js 16, React 19, TypeScript 5.3, Tailwind CSS v4 |
| **Backend** | FastAPI, Python 3.12, Supabase PostgreSQL |
| **API Tools** | 25 financial operation tools (transactions, investments, budgets, savings) |
| **Investment Types** | 8 (stocks, crypto, ETFs, funds, P2P lending, real estate, commodities, forex) |
| **Languages** | English, Spanish |
| **Currencies** | USD, EUR, GBP |
| **Deployment** | Google Cloud Run (serverless) |
| **CI/CD** | GitHub Actions (automated) |
| **Monitoring** | Sentry (error tracking + performance) |

---

## 🎯 Roadmap

### Completed ✅
- ✅ Voice-first interface with Gemini Live API
- ✅ 5-tab comprehensive dashboard
- ✅ 8-type investment portfolio
- ✅ Multi-language (EN/ES) support
- ✅ Multi-currency dual-storage architecture
- ✅ Monthly net worth snapshots
- ✅ Budget management + savings pots
- ✅ Transaction categorization

### In Development 🔄
- 🔄 More detailed investment analytics
- 🔄 Portfolio optimization suggestions
- 🔄 Tax reporting export (PDF)
- 🔄 Spending pattern analysis

### Future Ideas 💡
- 📌 Mobile app (iOS/Android)
- 📌 Automated savings recommendations
- 📌 Financial goal planning + milestone tracking
- 📌 Integration with banks (OWASP standards)
- 📌 Real-time portfolio rebalancing alerts

---

## 💬 Questions?

- 📖 Read the **[Documentation](ARCHITECTURE.md)**
- 🐛 Found a bug? **[Open an Issue](https://github.com/5anik4h/cloud_agent/issues)**
- 💡 Have ideas? **[Start a Discussion](https://github.com/5anik4h/cloud_agent/discussions)**

---

## 📄 License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ for the Gemini Live Agent Challenge**

[Visit Finrush →](https://finvoice.me4dows.com)

</div>
