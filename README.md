# Finrush 🎤💰

[![Status: Production](https://img.shields.io/badge/status-production-green?style=flat-square)](https://finrush.app)
[![Build: Passing](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](https://github.com/5anik4h/cloud_agent/actions)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-5.3-blue?logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/python-3.12-blue?logo=python&style=flat-square)](https://www.python.org/)

**Your AI Financial Assistant Powered by Gemini Live API**

## [👉 Try it live at finrush.app](https://finrush.app)

---

## What is Finrush?

**Stop wrestling with spreadsheets. Start talking to your money.**

Finrush is the voice-first, AI-powered personal finance assistant. Just speak naturally—add transactions, ask questions about your net worth, set budgets, track investments. Your AI handles categorization, calculations, organization, and real-time insights. No manual entry. No spreadsheets. Just **talk**.

---

## ✨ Key Features

### 🎤 Voice-First Experience

- Real-time PCM audio streaming (16kHz) via Web Audio API
- Natural language understanding via Google's Gemini Live API
- Speak conversationally, abbreviated, in English or Spanish
- Instant confirmation and feedback

### 🤖 Intelligent Processing

- Powered by **Google Gemini Live API** — understands context across multi-turn conversations
- Automatic transaction categorization (Income, Expenses, Investments, Savings)
- Complex investment parsing (stocks, crypto, ETFs, real estate, P2P lending, and more)
- Smart clarification when things are ambiguous

### 📊 5-Tab Comprehensive Dashboard

- **Summary** — Net worth at a glance + wealth evolution chart + portfolio breakdown
- **Balance** — Transactions history + 6 KPI cards (balance, income, expenses, savings)
- **Goals** — Budget management with progress tracking + savings pots with flexible targets
- **Investments** — 10-type portfolio: stocks, crypto, ETFs, funds, crowdlending, real estate, commodities, forex, fixed income, savings accounts
- **Savings** — Contribution analysis, accumulated balance trends, savings rate tracking

### 💱 Multi-Currency Support

- Switch seamlessly between **USD ($)**, **EUR (€)**, and **GBP (£)**
- Every amount stored in **original currency + USD equivalent + frozen exchange rate**
- Backend-driven conversion eliminates precision loss
- Accurate historical P&L calculations regardless of currency switches

### 🌍 Bilingual

- Full **English** and **Spanish** support
- Persistent language preference (remembers your choice)
- Agent responds in your selected language without code-switching

### 🎨 Premium Dark UI

- Stunning **glassmorphism design** with dark green & lime accent palette
- Reactive WebGL orb animation responding to voice input
- Smooth Framer Motion transitions
- Dark mode optimized for evening use

### 📈 Advanced Portfolio Management

- **Polymorphic investment system** supporting 10 asset types with dedicated tables
- **Live market prices** — Yahoo Finance integration with Finnhub fallback
- **Normalized P&L tracking** — consistent calculations across currency/asset type boundaries
- **Monthly net worth snapshots** — track your wealth evolution over time
- **Investment history** — every transaction frozen with its entry rate for accurate reporting

---

## 🚀 Get Started in 2 Minutes

### Sign In

1. Go to [finrush.app](https://finrush.app) and click **Sign In**
2. Enter your email — you'll receive a **magic link** (no password needed)
3. Alternatively, use **Google OAuth** for one-click login
4. Your dashboard starts empty — begin by speaking

### Quick Tutorial

Once logged in, click the microphone and try these:

**Adding transactions**

> *"I just paid €120 for electricity"*
> *"Received my salary, €2,400"*
> *"Spent $18 on lunch"*

**Querying your data**

> *"What's my balance this month?"*
> *"How much have I spent on food?"*
> *"Show me my net worth"*

**Budgets and savings**

> *"Create a budget of €300 for restaurants"*
> *"Open a savings pot called Vacation with a €1,500 goal"*
> *"Add €200 to my Vacation pot"*

**Investments**

> *"I bought 10 Apple shares at $185"*
> *"Add €5,000 to my crowdlending portfolio at 8% APY"*
> *"What's my total portfolio value?"*

**Images**

> Take a photo of a receipt or invoice and send it — the agent reads it and creates the transaction automatically.

Switch language (EN/ES) with the globe icon in the top bar. Switch currency (USD/EUR/GBP) with the button in the bottom bar.

---

## 💡 How It Works

```
You speak 🎤
    ↓
Audio captured by browser (Web Audio API, 16kHz PCM)
    ↓
Sent to backend via secure WebSocket
    ↓
Processed by Gemini Live API
    ↓
AI understands intent + calls financial tools
    ↓
Backend queries Supabase (row-level security)
    ↓
Dashboard updates in real-time
    ↓
Audio response streamed back to you 🔊
```

---

## 📍 Development & Full History

This is the **public release version** of Finrush. Full development history with full git trail (72 sessions, 200+ commits) documenting every architectural decision, iteration, and fix is available in the private repository. See [DEVLOG.md](DEVLOG.md) for session-by-session progress and detailed documentation.

---

## 🏗️ Technical Architecture

📊 **[See the complete system architecture diagram](docs/diagrams/architecture_mermaid.md)** with full-stack visualization, layer descriptions, and data flow examples.

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

---

## ⚠️ Disclaimer

**Finrush is NOT financial advice.** It's a personal finance tracker that helps you organize and understand your money.

**Not:** Tax advice, investment recommendations, or legal guidance
**Is:** Transaction tracking, budget management, net worth monitoring

Always verify calculations and consult a professional for major financial decisions.

---

## 💬 Feedback & Contributions

Have ideas or found a bug?

- **[Open an Issue](https://github.com/5anik4h/finrush-live-agent/issues)** — for bugs, feature requests, or specific improvements
- **[Start a Discussion](https://github.com/5anik4h/finrush-live-agent/discussions)** — for questions, ideas, and general feedback

---

## 📄 License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the #GeminiLiveAgentChallenge**

[Visit Finrush →](https://finrush.app)
