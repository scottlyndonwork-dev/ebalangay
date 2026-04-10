# eBalangay — project context

## What this is
Hyperlocal commerce + logistics platform for Mindanao, Philippines.
Monorepo with 4 apps: customer web, merchant web, rider mobile, admin web.
One shared Fastify API. PostgreSQL + Redis. React Native for mobile.

## Stack
- API: Node.js + Fastify + Prisma ORM
- DBs: PostgreSQL 16, Redis 7
- Frontend: Next.js 14 (app router), React Native (Expo)
- Payments: PayMongo (GCash, Maya, cards)
- Storage: Cloudflare R2
- AI: Anthropic Claude API (claude-sonnet-4-6)
- Queue: BullMQ (Redis-backed)

## Naming conventions
- Files: kebab-case (auth-service.ts)
- Classes: PascalCase (OrderService)
- Functions/vars: camelCase (getUserById)
- DB tables: snake_case (order_items)
- Env vars: UPPER_SNAKE_CASE

## Code rules
- TypeScript strict mode everywhere
- Zod for all input validation
- All DB writes inside Prisma transactions
- Never trust client for payment status — webhook only
- Always use validateTransition() before changing order status
- Return { data, error } shape from all API handlers

## Key docs (load on demand)
- Full schema: @docs/schema.md
- API patterns: @docs/api-patterns.md
- Architecture: @docs/architecture.md
- Progress tracker: @docs/phase-progress.md

## Ignored
node_modules, dist, build, .next, coverage, .expo, android, ios
