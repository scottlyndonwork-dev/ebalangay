// INVENTORY ALERT SYSTEM - TESTING GUIDE
// Complete end-to-end test workflow

// ==========================================
// 1. PREREQUISITES - START SERVERS
// ==========================================

// Terminal 1: Start full stack
cd c:\Users\SM\Desktop\eBalangay\ Project
pnpm dev

// You should see:
// ✅ Redis client connected
// ✅ BullMQ queues initialized
// ✅ Inventory workers initialized
// ✅ Inventory management routes registered
// ✅ Health check confirms DB connected

// Terminal 2: Watch logs (optional)
pnpm --filter @ebalangay/api dev | grep -E "inventory|alert|suggest|notif"

// ==========================================
// 2. CREATE MERCHANT WITH AUTH
// ==========================================

// Register merchant phone
curl -X POST http://localhost:3001/auth/register \
 -H "Content-Type: application/json" \
 -d '{
"phone": "09171234567"
}'

// Response includes OTP in logs (dev mode):
// 📧 Mock SMS sent to +639171234567, OTP: 000000

// Note the OTP token from response token field, then verify:
curl -X POST http://localhost:3001/auth/verify-otp \
 -H "Content-Type: application/json" \
 -d '{
"token": "otp_token_from_response",
"otp": "000000"
}'

// Response:
// {
// "data": {
// "accessToken": "eyJhbGc...",
// "refreshToken": "ref\_...",
// "user": {
// "id": "user-123",
// "phone": "+639171234567",
// "role": "MERCHANT"
// }
// }
// }

// Save token for next requests:
MERCHANT_TOKEN="eyJhbGc..."

// ==========================================
// 3. CREATE TEST PRODUCT
// ==========================================

// Create product with LOW initial stock
curl -X POST http://localhost:3001/products \
 -H "Authorization: Bearer $MERCHANT_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"name": "Arabica Coffee Beans",
"description": "Premium single-origin coffee",
"price": 450,
"stockQty": 15,
"reorderAt": 10,
"category": "Beverages",
"sku": "ARB-COFFEE-1KG",
"isB2B": false
}'

// Response:
// {
// "data": {
// "id": "prod-123",
// "name": "Arabica Coffee Beans",
// "stockQty": 15,
// "reorderAt": 10,
// ...
// }
// }

PRODUCT_ID="prod-123"

// ==========================================
// 4. VERIFY NO ALERT TRIGGERED YET
// ==========================================

// Check queue status (need admin token for this)
// Create admin user first:
curl -X POST http://localhost:3001/auth/register \
 -H "Content-Type: application/json" \
 -d '{"phone": "09171111111"}'

// Verify and set as admin (via database or manual API call)
// For testing, use merchant token initially (limited access)

// ==========================================
// 5. TRIGGER ALERT - MANUAL TEST FIRST
// ==========================================

// Use the manual trigger endpoint (safest for testing)
curl -X POST http://localhost:3001/inventory/alerts/test \
 -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT_ID\"
}"

// Response:
// {
// "success": true,
// "jobId": "manual-alert-prod-123-1712671800000",
// "message": "Restock alert triggered for product prod-123"
// }

// Console should show:
// 🔔 Processing restock alert for product prod-123
// 📊 Stock severity: low
// 💡 Generated suggestion: Order soon - popular item
// ✉️ Mock push sent to token: eyJ...
// ✅ Restock alert processed successfully

// ==========================================
// 6. TRIGGER ALERT - VIA STOCK ADJUSTMENT
// ==========================================

// Reduce stock below reorderAt (15 → 5)
curl -X PATCH http://localhost:3001/products/$PRODUCT_ID/stock \
 -H "Authorization: Bearer $MERCHANT_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"quantity": -10,
"reason": "bulk_sale_to_restaurant"
}'

// Response:
// {
// "data": {
// "id": "prod-123",
// "name": "Arabica Coffee Beans",
// "stockQty": 5,
// "reorderAt": 10,
// "previousStock": 15,
// "change": -10,
// "reason": "bulk_sale_to_restaurant"
// },
// "message": "Stock updated successfully"
// }

// Console should show:
// 📌 Restock alert queued for product prod-123 (stock: 5)
// [worker processes]
// 📊 Stock severity: critical (5 ≤ 2.5)
// 💡 Generated suggestion: Reorder now: 5 units left...
// ✉️ Mock push sent to token: ...
// ✅ Restock alert via job completed

// ==========================================
// 7. CHECK QUEUE STATUS
// ==========================================

// For admin: Create admin token first, then:
// curl -X GET http://localhost:3001/inventory/queue/status \
// -H "Authorization: Bearer $ADMIN_TOKEN" | jq

// Expected output:
// {
// "status": "ok",
// "queues": [
// {
// "name": "inventory",
// "counts": {
// "completed": 2,
// "active": 0,
// "waiting": 0,
// "failed": 0,
// "delayed": 0
// },
// "client": { "connected": true }
// },
// {
// "name": "notifications",
// "counts": {
// "completed": 2,
// "active": 0,
// "waiting": 0,
// "failed": 0,
// "delayed": 0
// },
// "client": { "connected": true }
// }
// ]
// }

// ==========================================
// 8. VIEW COMPLETED JOBS
// ==========================================

// curl -X GET "http://localhost:3001/inventory/queue/inventory/jobs?status=completed" \
// -H "Authorization: Bearer $ADMIN_TOKEN" | jq

// Response shows all completed alert jobs with data & results

// ==========================================
// 9. CHECK MERCHANT'S ALERT HISTORY
// ==========================================

curl -X GET http://localhost:3001/inventory/alerts/history \
 -H "Authorization: Bearer $MERCHANT_TOKEN" | jq

// Response:
// {
// "success": true,
// "count": 2,
// "alerts": [
// {
// "id": "alert-uuid",
// "createdAt": "2025-04-09T12:34:56Z",
// "product": {
// "id": "prod-123",
// "name": "Arabica Coffee Beans",
// "sku": "ARB-COFFEE-1KG"
// },
// "currentStock": 5,
// "reorderAt": 10,
// "severity": "critical",
// "suggestion": "Reorder now: 5 units left...",
// "status": "sent"
// },
// // ... manual test alert
// ]
// }

// ==========================================
// 10. CHECK LOW STOCK PRODUCTS
// ==========================================

curl -X GET http://localhost:3001/inventory/low-stock \
 -H "Authorization: Bearer $MERCHANT_TOKEN" | jq

// Response:
// {
// "success": true,
// "total": 1,
// "lowStockCount": 1,
// "products": [
// {
// "id": "prod-123",
// "name": "Arabica Coffee Beans",
// "sku": "ARB-COFFEE-1KG",
// "stockQty": 5,
// "reorderAt": 10,
// "urgency": "critical",
// "restockNeeded": 5
// }
// ]
// }

// ==========================================
// 11. TEST OUT OF STOCK SCENARIO
// ==========================================

// Reduce to 0 (highest priority = 100)
curl -X PATCH http://localhost:3001/products/$PRODUCT_ID/stock \
 -H "Authorization: Bearer $MERCHANT_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"quantity": -5,
"reason": "final_sale"
}'

// Should see in logs:
// 📊 Stock severity: out_of_stock
// 💡 Generated suggestion: ❌ Order immediately - popular item

// ==========================================
// 12. TEST CRITICAL THRESHOLD
// ==========================================

// Create another product and test critical threshold
curl -X POST http://localhost:3001/products \
 -H "Authorization: Bearer $MERCHANT_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"name": "Instant Noodles",
"price": 25,
"stockQty": 100,
"reorderAt": 40,
"category": "Noodles",
"sku": "NOODLES-BULK"
}'

// PRODUCT_ID2="prod-456"

// Reduce to critical (≤25% of 40 = ≤10)
curl -X PATCH http://localhost:3001/products/$PRODUCT_ID2/stock \
 -H "Authorization: Bearer $MERCHANT_TOKEN" \
 -d '{"quantity": -92, "reason": "big_order"}'

// Should show: severity: critical

// ==========================================
// 13. DATABASE VERIFICATION
// ==========================================

// Open Prisma Studio
cd packages/db
pnpm db:studio

// Navigate to:
// 1. InventoryAlert table
// - Should see 3+ rows
// - Check severity values: critical, out_of_stock, low
// - Verify suggestion text populated
//
// 2. Notification table
// - Should see 3+ rows
// - Check status: all should be "sent"
// - Check title/body populated
//
// 3. User table
// - Find your merchant user
// - pushTokens should be [] (or have Firebase tokens in prod)

// ==========================================
// 14. TEST FAILURE SCENARIOS
// ==========================================

// A. Stop Redis & try to trigger alert
// redis-cli shutdown

// Result: Logs show "⚠️ Skipping BullMQ queue initialization (Redis unavailable)"
// Workers don't start, no alerts queued

// B. Create with invalid product ID
curl -X POST http://localhost:3001/inventory/alerts/test \
 -H "Authorization: Bearer $MERCHANT_TOKEN" \
 -d '{"productId": "invalid-prod-id"}'

// Result: 403 Forbidden (not your product)

// ==========================================
// 15. CLEAN UP & VERIFY PERSISTENCE
// ==========================================

// Restart server
Ctrl+C # Stop server
pnpm dev # Restart

// Check that completed jobs still show in database
curl -X GET http://localhost:3001/inventory/alerts/history \
 -H "Authorization: Bearer $MERCHANT_TOKEN"

// Should still show all alerts from before restart!
// (Data persisted in PostgreSQL)

// ==========================================
// EXPECTED CONSOLE OUTPUT SUMMARY
// ==========================================

/\*
✅ Redis client connected
✅ BullMQ queues initialized
✅ All inventory workers initialized

[After manual alert test]
🔔 Processing restock alert for product prod-123
📊 Stock severity: low
💡 Generated suggestion: Order soon - popular item
✉️ Mock push sent to token: eyJ...
📌 Restock alert processed successfully
✅ Inventory alert job completed

[After stock adjustment]
📌 Restock alert queued for product prod-123 (stock: 5)
🔔 Processing restock alert for product prod-123
📊 Stock severity: critical
💡 Generated suggestion: Reorder now: 5 units left
✉️ Mock push sent to token: eyJ...
✅ Inventory alert job completed

[After out of stock]
🔔 Processing restock alert for product prod-123
📊 Stock severity: out_of_stock
💡 Generated suggestion: Order immediately - trending product
✉️ Mock push sent to token: eyJ...
✅ Inventory alert job completed
\*/

// ==========================================
// NEXT STEPS
// ==========================================

/\*
✅ Complete: BullMQ queue setup
✅ Complete: Worker consumers (alert + notification)
✅ Complete: AI suggestion generation (Anthropic)
✅ Complete: Database models (InventoryAlert, Notification)
✅ Complete: Management endpoints (admin)
✅ Complete: Merchant endpoints (low-stock, history)
✅ Complete: Integration with product routes

🔄 Next:

1. Implement real push notifications (Firebase Cloud Messaging)
2. Add WebSocket alerts (real-time merchant notifications)
3. Set up monitoring dashboard (BullBoard)
4. Create order system that also triggers alerts
5. Add delivery completion → restock check (reverse trigger)
   \*/
