# ZZIK v2 - 찍먹 (Production Architecture)

Location-based check-in rewards platform with full-stack implementation.

## 🏗️ Architecture

Monorepo structure following Phase 1→2 production scaling patterns:

```
zzik-v2/
├── apps/
│   └── web/          # Next.js App Router (user-facing)
├── packages/
│   ├── database/     # Prisma schema & client
│   ├── shared/       # Business logic (services, utils)
│   └── integrations/ # External APIs (Mapbox, etc.)
└── tests/
    └── e2e/          # Playwright tests
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (with earthdistance extension)

### Installation

```bash
# Install dependencies
pnpm install

# Setup database
pnpm db:generate
pnpm db:migrate

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📦 Features

### Core Features (Phase 1)

- ✅ **Interactive Map**: GPU-accelerated Mapbox clustering
- ✅ **Check-in Validation**: Distance (50m), GPS accuracy, fraud detection
- ✅ **Settlement System**: CPCV distribution (70/25/5)
- ✅ **Rate Limiting**: Upstash-based edge rate limiting
- ✅ **Idempotency**: 120s duplicate request protection
- ✅ **Observability**: Prometheus metrics endpoint

### 🆕 Subscription & Token System (CRITICAL)

- ✅ **Subscription Model**: FREE (3/month) + PREMIUM (unlimited) tiers
- ✅ **Token Economy**: Deferred cost model with 30% redemption rate
- ✅ **Stripe Integration**: Payment processing and webhooks
- ✅ **Voucher System**: Token → ₩5,000 vouchers (30-day validity)
- ✅ **Merchant Plans**: STARTER/GROWTH/PRO with check-in quotas
- ✅ **Unit Economics**: 95% gross margin (fixes -₩1,040 loss/check-in)

### 🆕 Enhanced Security (CRITICAL)

- ✅ **Real H3 Geospatial**: Production-grade H3 indexing (resolution 10)
- ✅ **4-Layer Fraud Detection**: GPS accuracy + H3 proximity + teleportation + cell jump
- ✅ **QR Code Backup**: JWT-signed QR codes for indoor check-ins
- ✅ **Fraud Scoring**: 0-1 scale with severity flags

### 🆕 Gamification Features (HIGH PRIORITY)

- ✅ **Streak System**: Daily check-in streaks with bonus tokens
- ✅ **Milestone Rewards**: 7d/14d/30d/60d/100d/365d milestones
- ✅ **Grace Period**: 12-hour recovery window for missed days
- ✅ **Leaderboard**: Social proof and competition

### UI/UX

- ✅ **Liquid Glass 2.0**: Glassmorphic design system
- ✅ **Linear 2025**: Typography and spacing tokens
- ✅ **Dark Mode**: OKLCH color space
- ✅ **Mobile-First**: Safe area support

## 🗄️ Database

PostgreSQL with PostGIS/earthdistance for geo queries.

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Open Prisma Studio
pnpm db:studio
```

## 🧪 Testing

```bash
# Run E2E tests
pnpm test
```

## 📊 Monitoring

### Metrics Endpoint

```bash
curl http://localhost:3000/api/metrics
```

## 🔐 Security

- ✅ Rate limiting (10/10s anon, 100/10s user)
- ✅ HSTS, X-Frame-Options, CSP headers
- ✅ Fraud detection (GPS accuracy, H3, teleportation)
- ✅ Idempotency keys

## 🌍 Environment Variables

See `.env.example` for all configuration options.

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `STRIPE_SECRET_KEY`: Stripe API key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `QR_CODE_SECRET`: JWT secret for QR code signing

Stripe Price IDs (create in Stripe Dashboard):
- `STRIPE_PREMIUM_PRICE_ID`: ₩9,900/month user subscription
- `STRIPE_MERCHANT_STARTER_PRICE_ID`: ₩299,000/month
- `STRIPE_MERCHANT_GROWTH_PRICE_ID`: ₩699,000/month
- `STRIPE_MERCHANT_PRO_PRICE_ID`: ₩1,499,000/month

Optional:
- `NEXT_PUBLIC_MAPBOX_TOKEN`: Mapbox GL JS token
- `UPSTASH_REDIS_REST_URL`: Redis cache/rate limit
- `UPSTASH_REDIS_REST_TOKEN`: Redis auth token
- `NEXT_PUBLIC_APP_URL`: Base URL for QR codes (default: https://zzik.app)

## 📝 Scripts

```bash
# Development
pnpm dev              # Start all services
pnpm build            # Build for production
pnpm lint             # Lint all packages

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Prisma Studio

# Testing
pnpm test             # Run E2E tests
```

## 🎨 Design System

### Liquid Glass Components

```tsx
// Offer cards
<div className="liquid-glass-offer animate-liquid-appear">
  {/* content */}
</div>

// Bottom sheets
<div className="liquid-glass-sheet animate-liquid-flow">
  {/* content */}
</div>

// Critical alerts
<div className="liquid-glass-critical animate-liquid-pulse">
  {/* content */}
</div>

// Icon buttons
<button className="icon-btn" data-active={isActive}>
  Label
</button>
```

## 🔄 Phase 2 Expansion

Ready for:
- Merchant dashboard (`apps/sponsor`)
- Real-time SSE/WebSocket
- Campaign management
- Advanced fraud detection (ML)
- Network pooling & staking
- Admin analytics

## 📚 Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL + PostGIS
- **Caching**: Upstash Redis
- **Maps**: Mapbox GL JS
- **Testing**: Playwright
- **Monitoring**: Prometheus metrics

## 🤝 Contributing

Follow the GenSpark AI Developer workflow:

1. Create/switch to `genspark_ai_developer` branch
2. Make changes
3. Commit immediately after every change
4. Create/update PR from `genspark_ai_developer` to `main`

## 📄 License

Private - GenSpark Internal

## 🔗 Links

- [Architecture Document](./docs/architecture.md)
- [API Documentation](./docs/api.md)
- [Design System](./docs/design-system.md)
