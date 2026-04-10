# Checkout Flow - Quick Reference Card

## 🚀 Quick Start

### 1. Configure PayMongo
```env
PAYMONGO_SECRET_KEY=sk_test_xxxxx
PAYMONGO_API_URL=https://api.paymongo.com/v1
```

### 2. Create Order
```bash
curl -X POST http://localhost:3001/orders \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "items": [{"productId": "uuid", "quantity": 2, "unitPrice": 500}],
    "addressLine": "Main St",
    "barangay": "Bgy 1"
  }'
```

### 3. Get Checkout URL
```json
{
  "data": {
    "payment": {
      "checkoutUrl": "https://checkout.paymongo.com/xxx"
    }
  }
}
```

## 📊 Architecture

```
API Request
    ↓
Transaction Begin
    ├─ SELECT FOR UPDATE (lock products)
    ├─ Validate stock
    ├─ Decrement stock
    ├─ Create order
    ├─ Create payment intent
    └─ Commit
    ↓
Return Checkout URL
```

## 🔒 Key Concepts

| Concept | Purpose | Effect |
|---------|---------|--------|
| SELECT FOR UPDATE | Lock rows | Prevents concurrent modifications |
| Transaction | Atomic operation | All or nothing |
| READ_COMMITTED | Isolation level | Prevents dirty reads |
| Rollback | Undo changes | Restores stock if payment fails |

## 📋 Database Schema

### orders table
```
id (PK)
customerId (FK)
merchantId (FK)
status (ENUM: PLACED, CONFIRMED, ...)
subtotal DECIMAL(10,2)
deliveryFee DECIMAL(10,2)
commission DECIMAL(10,2)
totalAmount DECIMAL(10,2)
addressLine STRING
barangay STRING
placedAt TIMESTAMP
```

### payments table
```
id (PK)
orderId (FK, UNIQUE)
provider (VARCHAR, default: paymongo)
intentId (VARCHAR)
reference (VARCHAR)
status (VARCHAR: pending, succeeded, failed)
amount DECIMAL(10,2)
paidAt TIMESTAMP?
```

### order_timelines table
```
id (PK)
orderId (FK)
status (ENUM: PLACED, CONFIRMED, ...)
timestamp (TIMESTAMP)
notes (TEXT)
```

## 🧪 Test Commands

### Test 1: Single Order
```powershell
.\checkout-test.ps1 -ProductId "uuid" -Token "jwt"
```

### Test 2: Concurrent Orders (SQL)
```sql
-- Terminal 1: Hold lock
BEGIN; SELECT * FROM products WHERE id='x' FOR UPDATE; SELECT pg_sleep(10); COMMIT;

-- Terminal 2: Try to order same product
-- (will block until Terminal 1 releases)
```

### Test 3: Stock Verification
```sql
SELECT stock_qty FROM products WHERE id = 'product-id';
```

## ⚠️ Error Codes

| HTTP | Error | Meaning |
|------|-------|---------|
| 400 | Validation Error | Invalid request format |
| 400 | Insufficient Stock | Not enough inventory |
| 400 | Product Not Found | Product doesn't exist |
| 401 | Unauthorized | Missing/invalid JWT |
| 500 | Internal Error | PayMongo or DB failure |

## 💡 Pro Tips

1. **Always use SELECT FOR UPDATE** when accessing stock
2. **Sort productIds** to prevent deadlocks
3. **Set transaction timeout** to handle slow APIs
4. **Use Prisma.Decimal** for all money fields
5. **Validate stock inside transaction**, not before
6. **Test concurrent orders** with load testing tool
7. **Monitor transaction duration** for performance issues
8. **Set CASCADE DELETE** on payment → order relations

## 🔗 Related Files

- `packages/api/src/services/checkout.ts` - Core logic
- `packages/api/src/services/paymongo.ts` - Payment provider
- `packages/api/src/routes/orders.ts` - API endpoints
- `packages/db/prisma/schema.prisma` - Database schema
- `CHECKOUT_IMPLEMENTATION.md` - Full guide
- `STOCK_LOCKING_TEST_GUIDE.md` - Testing reference

## 📞 Common Questions

**Q: What if PayMongo API fails?**
A: Transaction rolls back, stock is restored, customer retries

**Q: Can multiple products be from different merchants?**
A: Currently no - we use first product's merchant. TODO: implement multi-merchant orders

**Q: How long does a checkout take?**
A: ~100-200ms for 2 products (network dependent)

**Q: What if customer doesn't complete payment?**
A: Order stays PLACED, stock is locked. Implement timeout to auto-cancel.

**Q: How to cancel an order?**
A: POST /orders/:id/cancel (only from PLACED/CONFIRMED state)

**Q: How to implement refunds?**
A: Hook into PayMongo refund API, update payment status, create order note

## 🎯 Next Steps

1. [ ] Set up PayMongo webhook
2. [ ] Implement webhook handler
3. [ ] Add payment confirmation logic  
4. [ ] Test with real payment
5. [ ] Load test with 100+ concurrent orders
6. [ ] Implement multi-merchant ordering
7. [ ] Add order timeout auto-cancel
8. [ ] Implement refund flow
