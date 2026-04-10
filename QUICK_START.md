# eBalangay — Developer Quick Reference

## 🏃 Start Development

```bash
# Terminal 1: Start all dev servers
pnpm dev

# Terminal 2: (Optional) Run tests
cd apps/api && pnpm test:watch
```

**Servers** → API: http://localhost:3001 | Web: http://localhost:3000

---

## 📁 Project Structure

```
apps/
  api/        → Fastify backend (port 3001)
  web/        → Next.js frontend (port 3000)
  mobile/     → Expo React Native

packages/
  shared/     → Zod schemas, types, utils
```

---

## 🔧 Common Commands

| Task             | Command                                     |
| ---------------- | ------------------------------------------- |
| **Install deps** | `pnpm install`                              |
| **Format code**  | `pnpm format`                               |
| **Type check**   | `pnpm typecheck`                            |
| **Lint code**    | `pnpm lint`                                 |
| **Run tests**    | `pnpm test`                                 |
| **Build all**    | `pnpm build`                                |
| **Add package**  | `pnpm add <pkg> -w --filter=@ebalangay/web` |

---

## 🗄️ Database

```bash
cd apps/api

# Generate Prisma client
pnpm db:generate

# Create & apply migrations
pnpm db:migrate:dev

# Inspect data interactively
pnpm db:studio
```

**Note**: Requires PostgreSQL running at `localhost:5432`

---

## 📝 Code Standards

- **Prettier**: 100 chars, 2 spaces, no semicolons, single quotes
- **TypeScript**: Strict mode, ES2022, NodeNext
- **Validation**: Zod schemas in `packages/shared/src/schemas/`

---

## 🌐 Environment

- **API**: `apps/api/.env` (configured for dev)
- **Web**: `apps/web/.env.local` (configured for dev)
- **Mobile**: Uses `expo-secure-store` for secrets

---

## ⚠️ Important

- **React 18 types** are locked in root `package.json`
- **Web/Mobile** import from **Shared** ✅ (API doesn't import Web - avoid circular deps)
- **Never commit** uncommitted Prisma migrations

---

## 📚 Full Documentation

See `.github/copilot-instructions.md` for:

- Architecture details
- Development workflows
- API/Web/Mobile specifics
- Troubleshooting caveats

See `SETUP.md` for detailed setup steps and troubleshooting.

---

## 💡 Pro Tips

```bash
# Open Prisma Studio (visual DB editor)
cd apps/api && pnpm db:studio

# Run single app type check
cd apps/web && pnpm typecheck

# Reset Turbo cache
pnpm turbo prune --docker

# Add dev dependency to specific app
pnpm add --save-dev <pkg> -w --filter=@ebalangay/api
```
