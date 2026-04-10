# eBalangay Monorepo — Restructure Complete ✅

## 📋 What Changed

Your monorepo has been successfully restructured from a simple 3-package layout to an enterprise-grade architecture with **3 separate web portals, a centralized database package, and separated API**.

### Before vs After

| Aspect         | Before                                       | After                                                                        |
| -------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| **Structure**  | Single `apps/api`, `apps/web`, `apps/mobile` | 3 portals + API & DB in packages                                             |
| **Web App**    | Monolithic (`apps/web/`)                     | Split into 3 (`apps/web-customer/`, `apps/web-merchant/`, `apps/web-admin/`) |
| **API**        | `apps/api/`                                  | `packages/api/`                                                              |
| **Prisma**     | In `apps/api/prisma/`                        | Centralized at `packages/db/prisma/`                                         |
| **Ports**      | 3000 (web), 3001 (API)                       | 3000, 3002, 3003 (portals) + 3001 (API)                                      |
| **Workspaces** | 3                                            | 8                                                                            |

---

## 🎯 New Structure

```
ebalangay/
├── apps/
│   ├── web-customer/          ← Customer portal (port 3000)
│   ├── web-merchant/          ← Merchant portal (port 3002)
│   ├── web-admin/             ← Admin portal (port 3003)
│   └── mobile/                ← React Native app (Expo)
├── packages/
│   ├── api/                   ← Fastify backend (port 3001)
│   ├── db/                    ← Prisma schema & migrations
│   └── shared/                ← Shared types, schemas, utils
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .github/
    └── copilot-instructions.md
```

---

## 🚀 Quick Start

### Start All Servers

```bash
pnpm dev
# Automatically starts:
# - API on port 3001
# - Web customer on port 3000
# - Web merchant on port 3002
# - Web admin on port 3003
```

### Start Individual Apps

```bash
# Customer portal
pnpm --filter @ebalangay/web-customer dev

# Merchant portal
pnpm --filter @ebalangay/web-merchant dev

# Admin dashboard
pnpm --filter @ebalangay/web-admin dev

# API
pnpm --filter @ebalangay/api dev

# Mobile
pnpm --filter @ebalangay/mobile dev
```

### Database Management

```bash
pnpm db:generate      # Generate Prisma client
pnpm db:migrate:dev   # Create & apply migrations
pnpm db:migrate       # Apply migrations (production)
pnpm db:studio        # Open Prisma Studio (localhost:5555)
pnpm db:seed          # Run seed script
```

---

## 📊 Package Workspaces

| Package                   | Purpose                      | Port | Command                                     |
| ------------------------- | ---------------------------- | ---- | ------------------------------------------- |
| `@ebalangay/web-customer` | Customer browsing & ordering | 3000 | `pnpm --filter @ebalangay/web-customer dev` |
| `@ebalangay/web-merchant` | Merchant inventory & orders  | 3002 | `pnpm --filter @ebalangay/web-merchant dev` |
| `@ebalangay/web-admin`    | Admin moderation & analytics | 3003 | `pnpm --filter @ebalangay/web-admin dev`    |
| `@ebalangay/mobile`       | Expo/React Native app        | -    | `pnpm --filter @ebalangay/mobile dev`       |
| `@ebalangay/api`          | Fastify backend              | 3001 | `pnpm --filter @ebalangay/api dev`          |
| `@ebalangay/db`           | Prisma migrations            | -    | `pnpm db:migrate:dev`                       |
| `@ebalangay/shared`       | Shared types & utils         | -    | `pnpm --filter @ebalangay/shared build`     |

---

## 🔧 Environment Variables

### API (`packages/api/.env`)

```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://postgres:admin@localhost:5433/ebalangay_dev"
REDIS_URL="redis://localhost:6379"
JWT_SECRET=dev-secret-change-in-production
CUSTOMER_WEB_URL=http://localhost:3000
MERCHANT_WEB_URL=http://localhost:3002
ADMIN_WEB_URL=http://localhost:3003
```

### Database (`packages/db/.env`)

```env
DATABASE_URL="postgresql://postgres:admin@localhost:5433/ebalangay_dev"
```

### Web Apps (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or 3002, 3003
```

---

## 💡 Benefits of This Structure

### 1. **Independent Deployments**

- Each web portal deploys separately
- A bug in customer portal doesn't block merchant portal release

### 2. **Team Autonomy**

- 3 teams can work in parallel (customer, merchant, admin)
- No merge conflicts across portals
- Each team owns their portal's features

### 3. **Optimized Bundles**

- Customer portal only includes order tracking UI
- Merchant portal only includes inventory management UI
- Admin portal only includes moderation UI
- Smaller initial JavaScript payloads per portal

### 4. **Tailored UX**

- Each portal can have distinct design systems
- Workflows are optimized per role
- Different feature flags per portal

### 5. **Shared Foundation**

- `@ebalangay/shared` provides consistent types & schemas
- `@ebalangay/api` serves all portals
- `@ebalangay/db` ensures single source of truth for data

### 6. **Scalability Ready**

- Easy to add new portals (e.g., rider app)
- Clear separation of concerns
- Monorepo tools (Turbo) keep builds fast

---

## 🛠️ Common Commands

```bash
# Development
pnpm dev                    # Start all dev servers
pnpm build                  # Build all packages
pnpm lint                   # Lint all code
pnpm typecheck              # TypeScript check

# Database
pnpm db:generate            # Generate Prisma client
pnpm db:migrate:dev         # Create migrations
pnpm db:migrate             # Apply migrations
pnpm db:studio              # Open Prisma Studio

# Add Dependencies
pnpm add -w <package>                              # Root workspace
pnpm add -w <package> --filter=@ebalangay/api     # API only
pnpm add -w <package> --filter=@ebalangay/shared  # Shared only
```

---

## 📚 Documentation

- **Architecture & Conventions**: See [`.github/copilot-instructions.md`](../.github/copilot-instructions.md)
- **Full Setup Guide**: See [SETUP.md](../SETUP.md)
- **Quick Reference**: See [QUICK_START.md](../QUICK_START.md)
- **Database Schema**: Check `packages/db/prisma/schema.prisma`
- **API Code**: See `packages/api/src/`

---

## ⚠️ Important Notes

### Database Connection

- **Port**: PostgreSQL running on port **5433** (not default 5432)
- **Credentials**: `postgres:admin@localhost:5433/ebalangay_dev`
- **Ensure PostgreSQL is running** before starting the API

### Migrations

- After modifying `packages/db/prisma/schema.prisma`, run:
  ```bash
  pnpm db:migrate:dev
  ```
- This creates and applies the migration to your database

### Build Order

- `packages/shared` is built first
- `packages/api` depends on `packages/shared` and `packages/db`
- `packages/db` is built before `packages/api`
- Web portals depend on both `packages/shared` and `packages/api`

---

## 🧪 Testing the Setup

### Test All Servers Start

```bash
pnpm dev
```

This should show:

```
✓ API running on port 3001
✓ Web customer on port 3000
✓ Web merchant on port 3002
✓ Web admin on port 3003
```

### Test API Endpoints

```bash
curl http://localhost:3001/health
# Response: {"status":"ok","timestamp":"..."}
```

### View API Docs

Open http://localhost:3001/docs in your browser (Swagger UI)

### Test Web Portals

- Customer: http://localhost:3000 ("eBalangay Customer Portal")
- Merchant: http://localhost:3002 ("eBalangay Merchant Portal")
- Admin: http://localhost:3003 ("eBalangay Admin Portal")

---

## 🎉 You're All Set!

Your monorepo is now structured for enterprise-scale development with clear separation of concerns, independent deployments, and team autonomy.

**Next steps:**

1. Start the dev servers: `pnpm dev`
2. Build your first features
3. As you grow, split teams can work on separate portals
4. Deploy each portal independently when ready

For AI assistance, refer to [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) — it contains detailed architecture documentation and best practices.

---

**Questions?** Check the documentation above or ask your AI assistant! 🚀
