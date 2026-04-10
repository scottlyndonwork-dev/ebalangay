# Stock Locking Test Guide - Manual SQL Validation

## Understanding SELECT FOR UPDATE

### What It Does
```sql
SELECT id, stock_qty FROM products WHERE id = 'xxx' FOR UPDATE;
```
- **Acquires exclusive lock** on matching rows
- **Blocks other transactions** from modifying those rows
- **Automatically released** when transaction commits/rollbacks
- **Works across connections** - true row-level locking

### Lock Behavior Timeline

```
Transaction A                              Transaction B
───────────                              ───────────
BEGIN;                                   BEGIN;
  ↓
  SELECT * FROM products FOR UPDATE;     
  (Acquires lock)                        
  ↓                                       SELECT * FROM products FOR UPDATE;
                                          (BLOCKS - waiting for lock release)
  Wait 5 seconds...
  ↓
  UPDATE products SET stock_qty = 8;
  ↓
  COMMIT;                                  ↓
  (Lock released)                          (Lock acquired!)
                                           SELECT * FROM products FOR UPDATE;
                                           (Returns locked row)
```

## Test Scenarios

### Scenario 1: Verify Lock Acquisition (2 Terminal Windows)

**Terminal 1 - Acquire and Hold Lock:**
```sql
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Replace 'product-uuid' with a real product ID
SELECT id, name, stock_qty FROM products 
WHERE id = 'product-uuid' 
FOR UPDATE;

-- Hold lock for 10 seconds
SELECT pg_sleep(10);

COMMIT;
```

**Terminal 2 - Try to Lock Same Product:**
```sql
-- Run while Terminal 1 has lock
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- This will BLOCK until Terminal 1 releases lock
SELECT id, name, stock_qty FROM products 
WHERE id = 'product-uuid' 
FOR UPDATE;

-- If you're seeing this, Terminal 1's transaction is done
COMMIT;
```

**Expected Result**: Terminal 2 hangs for ~10 seconds, then completes

### Scenario 2: Verify Stock Decrement Atomicity

**Get Initial Stock:**
```sql
SELECT id, name, stock_qty FROM products WHERE sku = 'TEST-001';
```

**Create Order (via API):**
```bash
curl -X POST http://localhost:3001/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "xxx", "quantity": 3, "unitPrice": 100}],
    "addressLine": "Test",
    "barangay": "Test"
  }'
```

**Verify Stock Decreased:**
```sql
SELECT id, name, stock_qty FROM products WHERE sku = 'TEST-001';
-- Expected: stock_qty = previous - 3
```

### Scenario 3: Verify Rollback on Payment Failure

**Setup:**
1. Create product TEST-002 with 10 units
2. Create order that will fail payment

**Check Stock Before Order:**
```sql
SELECT stock_qty FROM products WHERE sku = 'TEST-002';
-- Expected: 10
```

**Create Order:**
```bash
curl -X POST http://localhost:3001/orders \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"items": [{"productId": "uuid", "quantity": 2, ...}], ...}'
```

**Simulate Payment Failure:**
```bash
# Modify paymongo.ts to throw error in createPaymentIntent
# This triggers transaction rollback
```

**Check Stock After Rollback:**
```sql
SELECT stock_qty FROM products WHERE sku = 'TEST-002';
-- Expected: 10 (stock restored!)
```

### Scenario 4: Concurrent Checkout Simulation

**Database Setup:**
```sql
-- Create test product
INSERT INTO products (id, business_id, name, price, category, sku, stock_qty)
VALUES ('test-concurrent-1', 'merchant-uuid', 'Concurrent Test', 100.00, 'RETAIL', 'CONC001', 5);
```

**Terminal 1:**
```sql
BEGIN;
SELECT id, stock_qty FROM products WHERE id = 'test-concurrent-1' FOR UPDATE;
-- Hold lock
SELECT pg_sleep(3);
-- Should show stock_qty = 5
UPDATE products SET stock_qty = 5 - 2 WHERE id = 'test-concurrent-1';
COMMIT;
```

**Terminal 2 (during T1 lock):**
```bash
# Run immediately after T1 acquires lock
curl -X POST http://localhost:3001/orders \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{
    "items": [{"productId": "test-concurrent-1", "quantity": 2, ...}],
    ...
  }'
# Response: BLOCKS until Terminal 1 releases lock (after 3 seconds)
# Then: Gets "Insufficient stock" error because T1 already decremented
```

**Expected Result**: 
- T1 succeeds (stock: 5 → 3)
- T2 fails with stock error

### Scenario 5: Deadlock Prevention

**Why Deadlocks Happen:**
```
T1: Lock Product A → Wait for Product B
T2: Lock Product B → Wait for Product A
(Deadlock!)
```

**How Our Code Prevents It:**
```typescript
// Always lock in same order: by productId ascending
const lockedProducts = await Promise.all(
  input.items
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map(item => /* lock query */)
)
```

**Test:**
```bash
# Safe: Should complete without deadlock
# Multi-product order with consistent locking order
curl -X POST http://localhost:3001/orders \
  -d '{
    "items": [
      {"productId": "aaa-1", "quantity": 1, ...},
      {"productId": "zzz-9", "quantity": 1, ...}
    ],
    ...
  }'
```

## Performance Metrics

### Lock Acquisition Time
```sql
-- Measure lock speed
DO $$ 
DECLARE 
  start_time TIMESTAMP;
  end_time TIMESTAMP;
BEGIN
  start_time := CLOCK_TIMESTAMP();
  
  BEGIN
    SELECT id FROM products WHERE id = 'xxx' FOR UPDATE;
    UPDATE products SET stock_qty = stock_qty - 1 WHERE id = 'xxx';
  END;
  
  end_time := CLOCK_TIMESTAMP();
  RAISE NOTICE 'Lock operation took: % ms', 
    EXTRACT(MILLISECOND FROM (end_time - start_time));
END $$;
```

**Expected**: < 5ms per product (on local machine)

### Transaction Isolation Levels

Current: **READ_COMMITTED**
```
- Prevents: Dirty reads
- Allows: Non-repeatable reads, phantom reads
- Why: Best for high-concurrency e-commerce
- Alternative: SERIALIZABLE (safer but slower)
```

## Monitoring Queries

### Check Active Locks
```sql
SELECT 
  t.tid,
  t.query,
  l.locktype,
  l.relation::regclass AS table_name
FROM pg_stat_activity t
JOIN pg_locks l ON t.pid = l.pid
WHERE l.granted = false
ORDER BY t.query_start;
```

### Check Blocked Queries
```sql
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.query AS blocked_query,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### View Transaction Duration
```sql
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY now() - pg_stat_activity.query_start DESC;
```

## Failure Recovery Examples

### Order Failed - Stock Not Restored (Bug)
```sql
-- Find orders without corresponding stock
SELECT 
  o.id,
  COUNT(oi.id) as items_count,
  GROUP_CONCAT(DISTINCT p.stock_qty) as current_stock
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE o.status = 'PLACED'
GROUP BY o.id;

-- Fix: Run checkout.ts again (will lock and decrement correctly)
```

### Transaction Timeout Handling
```sql
-- Check for stuck transaction
SELECT 
  pid, 
  now() - query_start as duration, 
  query 
FROM pg_stat_activity 
WHERE query_start < now() - INTERVAL '30 seconds'
  AND state = 'active';

-- Kill stuck transaction if needed
SELECT pg_terminate_backend(12345); -- Replace with PID
```

## Testing Checklist

- [x] Lock acquired when SELECT FOR UPDATE runs
- [ ] Multiple processes wait for lock
- [ ] Stock decrements correctly
- [ ] Rollback restores stock on failure
- [ ] No deadlocks with 10+ concurrent orders
- [ ] Lock released after 30 seconds (timeout)
- [ ] Payment intent created in same transaction
- [ ] Order timeline records transition
- [ ] WebSocket broadcast includes stock change
- [ ] Pagination works with large order count

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Lock timeout (30s)" | Slow PayMongo API | Increase timeout or use async webhook |
| Deadlock error | Unordered product locks | Always sort productIds before locking |
| Stock negative | Race condition bug | Add CHECK constraint: `stock_qty >= 0` |
| Payment stuck in pending | Webhook not implemented | Add PayMongo webhook handler |
| Order created but can't pay | No payment intent | Verify PAYMONGO_SECRET_KEY is set |
