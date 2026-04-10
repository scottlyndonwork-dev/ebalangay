# API package rules

## Route structure
- routes/auth.ts — auth endpoints
- routes/products.ts — catalog CRUD
- routes/orders.ts — order lifecycle
- routes/deliveries.ts — dispatch + GPS
- routes/payments.ts — PayMongo + webhooks
- routes/riders.ts — rider availability + earnings
- routes/analytics.ts — dashboard data

## Error handling pattern
All routes return:
{ success: true, data: {...} }   — on success
{ success: false, error: "msg" } — on failure
Never throw raw errors to client.

## Auth
- Protected routes use: preHandler: [app.authenticate]
- Role check: requireRole(['MERCHANT']) decorator
- JWT in Authorization: Bearer <token>

## Queues
- inventoryQueue — restock alerts
- payoutQueue — daily payouts (cron 22:00 PH time)
- dispatchQueue — rider job offers + retries
- notificationQueue — push + SMS sends
