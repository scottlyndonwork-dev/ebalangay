# eBalangay Project — AI Assistant Instructions

You are an AI assistant helping developers work on **eBalangay**, a full-stack TypeScript monorepo for managing community-based governance and services.

## Architecture Overview

### Monorepo Structure (Restructured)

- **Build system**: Turbo + pnpm workspaces (Node.js >=20, pnpm >=9)
- **Package manager**: pnpm (faster, stricter dependency management than npm)
- **Location**: `c:\Users\SM\Desktop\eBalangay Project`

### Apps (Web Portals)

#### `apps/web-customer` — Customer Portal (Port 3000)

- **Framework**: Next.js 14.2.21 with App Router
- **UI Framework**: React 18.3.1
- **Purpose**: Browse products, place orders, track deliveries, manage profile
- **Dev**: `pnpm --filter @ebalangay/web-customer dev` → http://localhost:3000
- **Build**: `pnpm --filter @ebalangay/web-customer build`

#### `apps/web-merchant` — Merchant Portal (Port 3002)

- **Framework**: Next.js 14.2.21 with App Router
- **Purpose**: Manage inventory, fulfill orders, view analytics, set store hours
- **Dev**: `pnpm --filter @ebalangay/web-merchant dev` → http://localhost:3002
- **Build**: `pnpm --filter @ebalangay/web-merchant build`

#### `apps/web-admin` — Admin Dashboard (Port 3003)

- **Framework**: Next.js 14.2.21 with App Router
- **Purpose**: Moderate merchants, manage disputes, view platform analytics, community settings
- **Dev**: `pnpm --filter @ebalangay/web-admin dev` → http://localhost:3003
- **Build**: `pnpm --filter @ebalangay/web-admin build`

#### `apps/mobile` — Expo/React Native

- **Framework**: Expo 52.0.28 with Expo Router
- **Runtime**: React Native 0.76.6
- **Purpose**: Customer + Rider mobile app (unified)
- **Mobile services**: Location, image handling, secure storage, maps (React Native Maps 1.18.0)
- **Dev**: `pnpm --filter @ebalangay/mobile dev` starts Expo dev server
- **Build**:
  - `pnpm build:preview` — EAS build (preview profile)
  - `pnpm build:production` — EAS build (production profile)

### Packages (Shared Libraries)

#### `packages/api` — Fastify Backend (Port 3001)

- **Framework**: Fastify 5.2.1 with plugins (CORS, Helmet, JWT, multipart, rate-limiting, Swagger)
- **Purpose**: REST API for all client apps
- **Database**: Uses `@ebalangay/db` package for Prisma client
- **Data validation**: Zod 3.24.1
- **External services**: AWS S3, Redis, Anthropic AI SDK
- **Job queue**: BullMQ (background processing)
- **Dev**: `pnpm --filter @ebalangay/api dev` → http://localhost:3001
- **Swagger Docs**: http://localhost:3001/docs
- **Testing**: Vitest with `pnpm --filter @ebalangay/api test`

#### `packages/db` — Database Layer (Prisma)

- **ORM**: Prisma 6.2.1
- **Database**: PostgreSQL
- **Purpose**: Centralized database schema and migrations
- **Database tasks**:
  - `pnpm db:generate` — Generate Prisma client
  - `pnpm db:migrate:dev` — Create and apply migrations (development)
  - `pnpm db:migrate` — Apply migrations (production)
  - `pnpm db:studio` — Open interactive Prisma Studio at localhost:5555
  - `pnpm db:seed` — Run seed script

#### `packages/shared` — Shared Utilities

- **Exports**: Shared types, schemas (Zod), utility functions, constants
- **Imported by**: All web apps, mobile, and API
- **Usage**: Import from `@ebalangay/shared` (workspace:\* protocol)

## Development Workflow

### Quick Start - All Servers

```bash
pnpm dev  # Starts all dev servers (Turbo parallel):
          # - API on port 3001
          # - Web customer on port 3000
          # - Web merchant on port 3002
          # - Web admin on port 3003
```

### Individual App Development

#### Customer Portal

```bash
pnpm --filter @ebalangay/web-customer dev   # Port 3000
```

#### Merchant Portal

```bash
pnpm --filter @ebalangay/web-merchant dev   # Port 3002
```

#### Admin Dashboard

```bash
pnpm --filter @ebalangay/web-admin dev      # Port 3003
```

#### API Backend

```bash
pnpm --filter @ebalangay/api dev            # Port 3001
# Swagger docs: http://localhost:3001/docs
```

#### Mobile Development

```bash
pnpm --filter @ebalangay/mobile dev         # Expo dev server
```

### Database Operations

```bash
# All database commands are in @ebalangay/db:
pnpm db:generate         # Generate Prisma client
pnpm db:migrate:dev      # Create & apply migrations
pnpm db:migrate          # Apply migrations (production)
pnpm db:studio           # Visual database editor (localhost:5555)
pnpm db:seed             # Run seed script
```

### Root Workspace Commands

```bash
pnpm build                # Build all packages in correct order (Turbo)
pnpm lint                 # Lint all packages
pnpm typecheck            # TypeScript check all packages
pnpm test                 # Run tests (API only currently)
pnpm format               # Prettier format all files
```

### Common Commands (Run from root)

```bash
# Build all packages
pnpm build

# Type check all workspaces
pnpm typecheck

# Lint all code
pnpm lint

# Format all files
pnpm format

# Install new dependency globally
pnpm add <package> -w

# Install dependency in specific workspace
pnpm add <package> -w --filter=@ebalangay/web-customer
pnpm add <package> -w --filter=@ebalangay/web-merchant
pnpm add <package> -w --filter=@ebalangay/web-admin
pnpm add <package> -w --filter=@ebalangay/api
pnpm add <package> -w --filter=@ebalangay/mobile
pnpm add <package> -w --filter=@ebalangay/shared
pnpm add <package> -w --filter=@ebalangay/db
```

## Code Conventions

### Formatting & Linting

- **Formatter**: Prettier with 100-char print width, 2-space tabs
- **Semicolons**: Not used (semi: false)
- **Quotes**: Single quotes
- **Trailing commas**: ES5 style
- **Tailwind CSS**: Sorted via prettier-plugin-tailwindcss

### TypeScript Standards

- **Target**: ES2022, module: NodeNext
- **Strict mode**: Enabled (`strict: true`)
- **Additional checks**:
  - `noUncheckedIndexedAccess` — Prevent unsafe indexing
  - `noImplicitOverride` — Explicit method overrides
  - `noUnusedLocals` / `noUnusedParameters` — Catch dead code
  - `declaration` / `declarationMap` / `sourceMap` — Full type definitions & debugging support

### Shared Validation & Types

Use **Zod schemas** in `packages/shared/src/schemas/` for data validation across all apps:

- Define once, use everywhere (API, Web, Mobile)
- Infer TypeScript types with `.infer<typeof schema>`
- API uses Zod for request validation; frontend uses for runtime safety

### State Management & Data Fetching

- **Web/Mobile**: Zustand stores for client state, React Query for server state
- **API**: Redis for caching, BullMQ for background jobs
- Keep client-side state minimal; prefer server-side source of truth

## Project Layout Reference

```
apps/
  web-customer/            ← Customer portal (Next.js)
    src/app/
      page.tsx
      layout.tsx
      globals.css
    tailwind.config.ts
    next.config.js
    package.json

  web-merchant/            ← Merchant portal (Next.js)
    src/app/
      page.tsx
      layout.tsx
      globals.css
    tailwind.config.ts
    next.config.js
    package.json

  web-admin/               ← Admin dashboard (Next.js)
    src/app/
      page.tsx
      layout.tsx
      globals.css
    tailwind.config.ts
    next.config.js
    package.json

  mobile/                  ← React Native (Expo)
    app/
      (tabs)/
        _layout.tsx
        index.tsx
    app.json
    package.json

packages/
  api/                     ← Fastify backend
    src/
      index.ts             ← Server entry point
    package.json
    tsconfig.json

  db/                      ← Database & Prisma
    prisma/
      schema.prisma        ← Database schema
      migrations/
    package.json
    .env

  shared/                  ← Shared types & utils
    src/
      types/
      schemas/             ← Zod validation schemas
      utils/
      constants/
    package.json
    index.ts

Root files:
  turbo.json               ← Turbo pipeline & caching rules
  pnpm-workspace.yaml      ← Workspace declaration
  tsconfig.base.json       ← Base TypeScript config (inherited by all)
  .prettierrc               ← Shared Prettier config
  package.json             ← Root workspace config
  .github/
    copilot-instructions.md ← AI assistant guide
```

## Important Caveats & Pitfalls

### React 18 Typing in Monorepos

- **Issue**: Dependencies may pull `@types/react@19` which breaks React 18 projects
- **Solution**: Use root `package.json` overrides:
  ```json
  "overrides": {
    "@types/react": "^18.3.x",
    "@types/react-dom": "^18.3.x"
  }
  ```
- **Why**: Transitive dependencies can pull newer React types; force consistency at the workspace root

### Build Order & Cross-Package Dependencies

- API cannot import from Web (circular dependency risk)
- Web/Mobile can safely import from Shared
- Shared must be built before Web/Mobile builds (Turbo respects this)
- When adding shared code: export from `packages/shared/src/index.ts` and bump the shared version reference in dependents

### Environment Variables

- **API**: Expects `.env` file with database URL, AWS keys, Anthropic API key, Redis URL
- **Web**: `.env.local` for API endpoints; publicly accessible vars prefixed with `NEXT_PUBLIC_`
- **Mobile**: Use `expo-secure-store` for sensitive credentials, not plain environment files

### Prisma Migrations in Development

- After modifying `prisma/schema.prisma`, run `pnpm db:migrate:dev` to create & apply migration
- Name migrations descriptively (e.g., `add_user_profile_fields`)
- Never commit uncommited migrations to version control

## How to Help

When working on this project, I can:

- ✅ Add features to API (Fastify routes, Prisma models, validation)
- ✅ Create React components & pages (Web with Next.js App Router)
- ✅ Build mobile screens (Expo Router, React Native)
- ✅ Update shared types & schemas (Zod, TypeScript interfaces)
- ✅ Run tests, lint, format, typecheck
- ✅ Debug Turbo caching issues or dependency conflicts
- ✅ Suggest improvements to project structure or performance
- ❌ Configure GitHub Actions / CI-CD (requires repo access)
- ❌ Manage cloud infrastructure (AWS, EAS, deployments)

## Key Files to Reference

- **API Routes**: `apps/api/src/` — Entry point and route handlers
- **Prisma Schema**: `apps/api/prisma/schema.prisma` — Database structure
- **Web Layout**: `apps/web/src/app/layout.tsx` → `apps/web/src/app/providers.tsx` — Client setup
- **Shared Types**: `packages/shared/src/types/index.ts`
- **Build Config**: `turbo.json` — Task dependencies and caching
- **TypeScript Base**: `tsconfig.base.json` — Strict compilation rules
