# 🏛️ Debate Room

> **"Where Arguments Meet Consensus"** — Trustless AI-Powered Debates on GenLayer

[![Built on GenLayer](https://img.shields.io/badge/Built%20on-GenLayer-blue)](https://genlayer.com)
[![Hackathon](https://img.shields.io/badge/Bradbury-Hackathon-purple)](https://dorahacks.io/hackathon/genlayer-bradbury/detail)
[![Live Demo](https://img.shields.io/badge/Demo-Live-green)](https://local-test-three.vercel.app)

**Debate Room** is the world's first decentralized debate platform that combines on-chain AI intelligence with democratic consensus to produce fair, transparent, and tamper-proof judgments. Built on GenLayer Protocol for the Bradbury Builders Hackathon.

---

## ✨ Features

- 🤖 **AI-Powered Judging** — Intelligent Contracts evaluate arguments using 6 scoring criteria
- 🗳️ **Optimistic Democracy** — Consensus mechanism ensures no single AI can manipulate results
- ⚖️ **Equivalence Principle** — Flexible tolerance for AI non-determinism without sacrificing integrity
- 🐦 **Tweet Debates** — Import topics directly from Twitter/X
- 🔐 **Multi-Auth** — Email, Social, or Wallet login via Privy
- 📊 **Real-Time Scoring** — Live leaderboard with transparent score breakdowns
- ⚡ **Hybrid Architecture** — Blockchain for trust, database for speed

---

## 🔴 The Problem We Solve

| Problem | Debate Room Solution |
|---|---|
| Debate judging is subjective & biased | AI judging verified through on-chain consensus |
| No transparency in how winners are chosen | Every evaluation is permanently recorded on blockchain |
| Platforms controlled by centralized entities | Decentralized — no single party controls outcomes |
| Quality arguments drowned by popularity | AI scores based on logic, evidence, and structure |

---

## 🧠 Technology Pillars

### 1. Intelligent Contracts — *The Thinking Brain*

Unlike traditional smart contracts, our Intelligent Contract understands **natural language**, evaluates arguments across 6 dimensions, and produces verifiable judgments:

```
Traditional:   if (votes_a > votes_b) → winner = a
Debate Room:   AI analyzes arguments → multi-dimensional scoring → verified consensus → fair outcome
```

### 2. Optimistic Democracy — *Trustless Consensus*

```
  🎯 Leader Node ──── AI Evaluation ────► 📊 Score
                                            │
                    ┌───────────────────────┤
                    │           │           │
              🔍 Validator  🔍 Validator  🔍 Validator
                    │           │           │
                    └─────────┬─────────────┘
                              │
                         ✅ Consensus
```

- **Leader** evaluates using LLM → **Validators** independently verify → **Majority** accepts or appeals

### 3. Equivalence Principle — *Measured Tolerance*

AI output is non-deterministic — different LLMs may score differently. We apply a **15-point tolerance**:

```python
def validator_fn(leader_result, validator_result):
    # Scores within 15 points = equivalent (consensus reached)
    return abs(leader_score - validator_score) <= 15
```

---

## 🏗️ Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Frontend   │◄──►│    Supabase DB   │◄──►│  GenLayer Chain  │
│  Next.js 15  │    │  Fast Queries    │    │  Source of Truth  │
│  TypeScript  │    │  Caching Layer   │    │  AI Judging       │
└──────────────┘    └──────────────────┘    └──────────────────┘
```

### Data Flow
1. **Create Debate** → Deploy Intelligent Contract → Save metadata to DB
2. **Submit Argument** → Write on-chain → AI evaluates in real-time → Sync to DB
3. **Debate Ends** → Finalize results on-chain → Consensus verified → Leaderboard updated

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Blockchain | GenLayer (Python Intelligent Contracts) |
| Database | Supabase (PostgreSQL) |
| Auth | Privy (Email, Social, Wallet) |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Privy account
- GenLayer Studio access

### Installation

```bash
# Clone
git clone https://github.com/Amarudinn/local-test.git
cd local-test

# Install
npm install

# Configure
cp .env.example .env.local
# Fill in your environment variables

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_GENLAYER_RPC_URL` | ✅ | GenLayer RPC endpoint |
| `NEXT_PUBLIC_GENLAYER_CHAIN_ID` | ✅ | GenLayer chain ID |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `NEXT_PUBLIC_PRIVY_APP_ID` | ✅ | Privy application ID |
| `GENLAYER_PRIVATE_KEY` | ✅ | Private key for contract transactions |
| `CRON_SECRET` | ✅ | Secret for cron job authentication |

---

## 📁 Project Structure

```
debate-room/
├── app/                          # Next.js pages & API routes
│   ├── api/cron/                 # Automated evaluation & sync jobs
│   ├── debates/                  # Debate pages (browse, create, detail)
│   ├── docs/                     # Documentation page
│   ├── how-it-works/             # How it works page
│   └── roadmap/                  # Roadmap page
├── components/                   # React components
│   ├── auth/                     # Authentication (Login, Profile)
│   ├── debates/                  # Debate UI (Create, Detail, List)
│   └── ui/                       # Reusable UI components
├── contracts/                    # GenLayer Intelligent Contracts
│   └── debate_room.py            # Core debate contract (v0.2.0)
├── lib/                          # Utilities & services
│   ├── genlayer-client.ts        # Blockchain interaction layer
│   ├── supabase-client.ts        # Database operations
│   └── sync-service.ts           # Bidirectional sync service
├── public/                       # Static assets & contract source
└── scripts/                      # Deployment & setup scripts
```

---

## 🗺️ Roadmap

### ✅ Now — Foundation
- Classic & Modern Debate modes with AI judging
- Tweet Debates (import from Twitter/X)
- Real-time evaluation & leaderboard

### 🔜 Next — Growth
- 🏆 Token rewards for high-quality debaters
- 📊 On-chain reputation system
- 🌐 Multi-language debate support

### 🚀 Future — Expansion
- 🏛️ DAO Governance Debates
- 🤖 AI vs AI Debate Arena
- 📜 Decentralized Dispute Resolution
- 🗳️ Network State Deliberation

---

## 🔗 GenLayer Alignment

| GenLayer Vision | Our Implementation |
|---|---|
| *AI agents that autonomously transact* | AI Judges autonomously evaluate & decide winners |
| *Trustless decision-making* | Verified through Optimistic Democracy consensus |
| *Process natural language* | Contract reads & analyzes human language arguments |
| *On-chain trust + off-chain intelligence* | AI evaluation locked into blockchain consensus |

---

## 📜 Mission Statement

> *"Debate Room builds a future where every public discussion is judged by the strength of arguments, not the strength of authority. By combining Intelligent Contracts, Optimistic Democracy, and the Equivalence Principle from GenLayer Protocol, we create debate infrastructure that is fundamentally fair — where AI becomes the neutral judge, blockchain becomes the immutable witness, and decentralized consensus becomes the guarantee of justice."*

