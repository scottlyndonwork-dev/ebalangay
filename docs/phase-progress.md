# eBalangay build progress

## Phase 0 — Environment setup
- [x] Monorepo created with pnpm workspaces + Turborepo
- [x] .env files created and .gitignore updated
- [ ] Docker compose for local PostgreSQL + Redis

## Phase 1 — Database + auth
- [x] Prisma schema created with all models
- [x] Initial migration run (npx prisma migrate dev --name init)
- [x] Fastify server bootstrapped with JWT + CORS
- [x] Auth routes: register, verify-otp, login, refresh, logout

## Phase 2 — Catalog + inventory
- [x] Product CRUD endpoints
- [x] B2BPricing model + endpoints
- [x] Cloudflare R2 image upload
- [x] BullMQ restock alert worker

## Phase 3 — Orders + payments
- [x] Order state machine (validateTransition + canCancel)
- [x] Checkout with SELECT FOR UPDATE stock locking
- [x] PayMongo payment intent creation
- [x] Webhook handler for payment.paid / payment.failed events

## Phase 4 — Dispatch + GPS
- [x] Socket.io WebSocket server
- [x] Rider availability Redis sets
- [x] Dispatch algorithm (nearest rider)
- [x] GPS location Redis TTL system
- [x] Proof of delivery upload

## Phase 5 — Payouts + AI
- [x] Daily payout BullMQ cron worker (workers/payout.ts — 22:00 PH, PayMongo Transfers)
- [x] Claude API: restock suggestion (services/ai.ts — generateRestockSuggestion)
- [x] Claude API: product description generator (services/ai.ts — generateProductDescription)
- [x] Claude API: weekly merchant summary cron (workers/payout.ts — Monday 08:00 PH)
- [x] Claude API: customer support chatbot (services/ai.ts — streamCustomerSupport, SSE via /ai/chat)
- [x] Firebase push notification worker (services/notifications.ts — FCM + DB persistence)
- [x] AI routes: POST /ai/product-description, GET /ai/restock-suggestions, POST /ai/chat
- [x] Notification routes: POST /notifications/register-token

## Phase 6 — Frontend apps
- [x] Shared typed API client (packages/shared/src/api.ts)
- [x] Merchant web (Next.js) — dashboard, products, orders, B2B, inventory, settings
- [x] Customer web (Next.js) — home, merchants, product pages, cart, checkout, order tracking, AI chat
- [x] Admin web (Next.js) — dashboard, merchants, users, orders, analytics (Recharts), live map (Leaflet)
- [x] Mobile app — customer stack (home feed, search, cart, orders, live tracking with react-native-maps)
- [x] Mobile app — rider stack (dashboard + online toggle, job-offer modal 60s countdown, active delivery, proof of delivery, earnings)

## Phase 7 — Deploy

### Infrastructure files (created)
- [x] packages/api/railway.toml — Railway build + deploy config
- [x] apps/web-customer/vercel.json, apps/web-merchant/vercel.json, apps/web-admin/vercel.json
- [x] apps/mobile/eas.json — Expo EAS preview + production profiles
- [x] scripts/prelaunch-check.ts — 8-step end-to-end API smoke test

### Deployment steps (manual — requires accounts)
- [ ] Railway.app: deploy API service + add PostgreSQL + Redis plugins
- [ ] Railway: set all env vars (see packages/api/.env for list)
- [ ] Vercel: import each web app repo, set NEXT_PUBLIC_API_URL
- [ ] Vercel: add custom domains (app / merchant / admin .ebalangay.com)
- [ ] Cloudflare DNS: CNAME records for all 3 subdomains + api subdomain
- [ ] PayMongo dashboard: register webhook → https://api.ebalangay.com/webhooks/paymongo
- [ ] Firebase: create project, download service account JSON, set env var
- [ ] Expo EAS: eas login && eas build --platform android --profile preview
- [ ] Run: npx tsx scripts/prelaunch-check.ts (against prod URL)

### Pre-launch checklist
- [ ] GET /health returns 200 from Railway URL
- [ ] PayMongo webhook registered and verified (payment.paid + payment.failed)
- [ ] CORS allows all 3 Vercel domains (set ALLOWED_ORIGINS env var)
- [ ] WebSocket connects from production frontend
- [ ] Cloudflare DNS propagated for all subdomains
- [ ] EAS APK builds successfully and installs on test device
- [ ] prelaunch-check.ts passes all 8 checks against prod
- [ ] Admin account created with ADMIN role in prod DB
- [ ] First test merchant account created and verified
