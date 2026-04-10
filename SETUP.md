# eBalangay Project Setup Guide

## ✅ Setup Complete

The following has been configured for development:

### 1. **Dependencies Installed**

- All 1,348 packages installed via pnpm
- Turbo configured for monorepo build orchestration
- Prisma client generated from schema

### 2. **Environment Variables**

- **API** (`apps/api/.env`): Development database URL, Redis, JWT, and service integrations
- **Web** (`apps/web/.env.local`): API endpoint configuration

### 3. **Project Structure Verified**

- ✅ `apps/api` — Fastify backend with Prisma ORM
- ✅ `apps/web` — Next.js 14 frontend
- ✅ `apps/mobile` — Expo React Native app
- ✅ `packages/shared` — Shared types, schemas, utilities

---

## 🚀 Quick Start

### Start All Dev Servers

```bash
pnpm dev
```

- **API**: http://localhost:3001
- **Web**: http://localhost:3000
- **Mobile**: Expo dev server

### API Development

```bash
cd apps/api

# Start dev server with hot reload
pnpm dev

# Run tests
pnpm test

# Create a new migration (after schema changes)
pnpm db:migrate:dev

# Inspect database interactively
pnpm db:studio
```

### Web Development

```bash
cd apps/web

# Start dev server
pnpm dev

# Build for production
pnpm build

# Run type checking
pnpm typecheck
```

### Mobile Development

```bash
cd apps/mobile

# Start Expo dev server
pnpm dev

# Run on device
pnpm android    # or pnpm ios
```

---

## 📋 Important Notes

### Database Setup

Before running the API, ensure PostgreSQL is running with:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ebalangay_dev"
```

To set up the database:

```bash
cd apps/api
pnpm db:migrate:dev  # Creates and applies migrations
pnpm db:seed         # Populates seed data (if available)
```

### Environment Variables

All environment files are configured for **local development** with placeholder values for external services (PayMongo, Anthropic, Cloudflare R2). Update these with real credentials when needed:

- **API**: `apps/api/.env`
- **Web**: `apps/web/.env.local`
- **Mobile**: Uses `expo-secure-store` for sensitive data (no .env file)

### Code Standards

- **Prettier**: 100-char width, 2-space tabs, no semicolons, single quotes
- **TypeScript**: Strict mode enabled, ES2022 target, NodeNext module resolution
- **Validation**: Use Zod schemas from `packages/shared/src/schemas/`

---

## 🛠️ Common Tasks

### Add a Dependency

```bash
# Global (all workspaces)
pnpm add <package> -w

# Specific workspace
pnpm add <package> -w --filter=@ebalangay/web

# Dev dependency
pnpm add --save-dev <package> -w --filter=@ebalangay/api
```

### Format Code

```bash
pnpm format  # Formats all files with Prettier
```

### Run Type Checking

```bash
pnpm typecheck  # All packages
cd apps/api && pnpm typecheck  # Single app
```

### Run Linting

```bash
pnpm lint  # All packages
```

### Build All Packages

```bash
pnpm build  # Uses Turbo to intelligently build dependencies
```

---

## 📚 Documentation

- **Architecture & Conventions**: See `.github/copilot-instructions.md`
- **Prisma Schema**: `apps/api/prisma/schema.prisma`
- **Next.js Config**: `apps/web/next.config.ts`
- **Turbo Config**: `turbo.json`
- **TypeScript Base**: `tsconfig.base.json`

---

## ⚠️ Known Caveats

### React 18 Typing Issues

The root `package.json` should have overrides to force React 18 types:

```json
"overrides": {
  "@types/react": "^18.3.x",
  "@types/react-dom": "^18.3.x"
}
```

This prevents transitive dependencies from pulling React 19 types.

### Prisma Migrations

- Always run `pnpm db:migrate:dev` after modifying `prisma/schema.prisma`
- Never commit uncommitted migrations
- Name migrations descriptively

### Build Dependencies

- **Web/Mobile** can import from **Shared**
- **API** should NOT import from **Web** (prevents circular deps)
- Turbo respects this order when building

---

## 🐛 Troubleshooting

### TypeScript errors after installing a package

```bash
# Restart TypeScript server in your editor, or regenerate Prisma client
cd apps/api && pnpm db:generate
```

### Port already in use

- **API**: `lsof -i :3001` (macOS/Linux) or `netstat -ano | findstr :3001` (Windows)
- **Web**: `lsof -i :3000` (macOS/Linux) or `netstat -ano | findstr :3000` (Windows)

### Database connection errors

- Ensure PostgreSQL is running
- Verify `DATABASE_URL` in `apps/api/.env` is correct
- Check Redis is running (for BullMQ jobs)

### Turbo cache issues

```bash
pnpm turbo prune --docker  # Reset Turbo cache
```

---

## 📞 Support

For AI-assisted help, refer to `.github/copilot-instructions.md` which contains:

- Detailed architecture documentation
- Code conventions and patterns
- Development workflows
- Important caveats and anti-patterns

Start a conversation with your AI assistant using this knowledge base!
