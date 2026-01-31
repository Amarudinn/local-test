# Debate Room - Decentralized Debate Platform

A decentralized debate platform built on GenLayer blockchain with AI-powered judging.

## Features

- 🔐 Multi-method authentication (Email, Social, Wallet)
- 🎯 Create and participate in debates
- 🤖 AI-powered objective judging
- 🏆 Transparent leaderboards
- 📊 Real-time monitoring and analytics
- ⚡ Hybrid architecture (Blockchain + Database)

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Blockchain**: GenLayer (Python Intelligent Contracts)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Privy
- **State Management**: TanStack Query
- **Monitoring**: Custom logging + Sentry + Google Analytics

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Privy account
- GenLayer Studio access

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ruang-debat
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Configure environment variables in `.env.local`:
   - GenLayer RPC URL and Chain ID
   - Supabase URL and keys
   - Privy App ID
   - (Optional) Sentry DSN
   - (Optional) Google Analytics ID

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
ruang-debat/
├── app/                      # Next.js app directory
│   ├── providers.tsx         # Root providers with monitoring
│   └── ...
├── lib/                      # Utility libraries
│   ├── logger.ts             # Centralized logging
│   ├── monitoring.ts         # Performance monitoring
│   ├── analytics.ts          # User analytics
│   ├── error-boundary.tsx    # React error boundary
│   ├── sentry.config.ts      # Sentry configuration
│   └── examples/             # Usage examples
├── contracts/                # Smart contracts (Python)
├── components/               # React components
├── .env.example              # Environment variables template
├── MONITORING_SETUP.md       # Monitoring documentation
└── package.json
```

## Monitoring and Logging

The platform includes comprehensive monitoring and logging capabilities. See [MONITORING_SETUP.md](./MONITORING_SETUP.md) for detailed documentation.

### Quick Start

**Logging:**
```typescript
import { logger, logAuth, logBlockchain } from '@/lib/logger';

// Log user actions
logAuth.login(userAddress, 'email');

// Log blockchain operations
logBlockchain.deploy(contractAddress, userAddress);
```

**Performance Tracking:**
```typescript
import { performanceMonitor } from '@/lib/monitoring';

const endTimer = performanceMonitor.startTimer('operation-name');
// ... perform operation
endTimer();
```

**Analytics:**
```typescript
import { trackDebate } from '@/lib/analytics';

trackDebate.created(contractAddress, topic, duration);
```

### Optional Integrations

**Sentry (Error Tracking):**
1. Install: `npm install @sentry/nextjs`
2. Set `NEXT_PUBLIC_SENTRY_DSN` in `.env.local`
3. Uncomment Sentry code in `lib/sentry.config.ts`

**Google Analytics:**
1. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in `.env.local`
2. Analytics will initialize automatically

## Development

### Running Tests
```bash
npm test
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
npm start
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Environment Variables for Production

Ensure these are set in your production environment:
- `NEXT_PUBLIC_GENLAYER_RPC_URL`
- `NEXT_PUBLIC_GENLAYER_CHAIN_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_SENTRY_DSN` (optional)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` (optional)

## Monitoring in Production

### Key Metrics to Monitor

1. **Error Rate**: Track via Sentry dashboard
2. **Performance**: Monitor page load times and API response times
3. **User Activity**: Track via Google Analytics
4. **Blockchain**: Monitor transaction success rates
5. **Database**: Track query performance

### Setting Up Alerts

Configure alerts in Sentry for:
- Critical errors (immediate notification)
- High error rate (> 10 errors/hour)
- Slow transactions (> 30s)
- Database connection failures

## Architecture

### Hybrid Architecture

- **Blockchain (GenLayer)**: Source of truth for arguments and AI judging
- **Database (Supabase)**: Fast queries and caching
- **Frontend (Next.js)**: User interface and state management

### Data Flow

1. User creates debate → Deploy contract → Save metadata to DB
2. User joins debate → Submit argument on-chain → Sync to DB
3. Debate ends → Resolve on-chain → AI judges → Store results → Sync to DB
4. User views leaderboard → Fetch from DB (cached) or blockchain

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

[Your License Here]

## Support

For issues or questions:
- Check [MONITORING_SETUP.md](./MONITORING_SETUP.md) for monitoring issues
- Review Sentry dashboard for errors
- Check Google Analytics for user behavior
- Open an issue on GitHub

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Advanced AI judging criteria
- [ ] Debate categories and tags
- [ ] User reputation system
- [ ] NFT badges for winners
- [ ] Real-time debate updates (WebSocket)
- [ ] Debate templates
- [ ] Moderation tools
- [ ] API for third-party integrations
