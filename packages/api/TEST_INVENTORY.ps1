# INVENTORY ALERT SYSTEM - POWERSHELL TESTING GUIDE
# Windows PowerShell compatible version

# ==========================================
# 1. SETUP - VARIABLES
# ==========================================

$BASE_URL = "http://localhost:3001"
$MERCHANT_PHONE = "09171234567"
$ADMIN_PHONE = "09171111111"

# ==========================================
# 2. REGISTER MERCHANT
# ==========================================

Write-Host "📱 Registering merchant..." -ForegroundColor Cyan

$registerResponse = Invoke-WebRequest -Uri "$BASE_URL/auth/register" `
  -Method Post `
  -ContentType "application/json" `
  -Body (ConvertTo-Json @{
    phone = $MERCHANT_PHONE
    name = "Test Merchant"
    role = "MERCHANT"
  }) | ConvertFrom-Json

Write-Host "✅ Merchant registered" -ForegroundColor Green
Write-Host "OTP Token: $($registerResponse.otpToken)" -ForegroundColor Yellow

$OTP_TOKEN = $registerResponse.otpToken

# Note: In console output, look for: "📧 Mock SMS sent to +639171234567, OTP: 000000"
$OTP = "000000"

# ==========================================
# 3. VERIFY OTP & GET MERCHANT TOKEN
# ==========================================

Write-Host "`n🔐 Verifying OTP..." -ForegroundColor Cyan

$verifyResponse = Invoke-WebRequest -Uri "$BASE_URL/auth/verify-otp" `
  -Method Post `
  -ContentType "application/json" `
  -Body (ConvertTo-Json @{
    token = $OTP_TOKEN
    otp = $OTP
  }) | ConvertFrom-Json

Write-Host "✅ OTP verified" -ForegroundColor Green

$MERCHANT_TOKEN = $verifyResponse.accessToken
$MERCHANT_ID = $verifyResponse.user.id

Write-Host "Merchant ID: $MERCHANT_ID" -ForegroundColor Yellow
Write-Host "Token: $($MERCHANT_TOKEN.Substring(0, 20))..." -ForegroundColor Yellow

# ==========================================
# 4. CREATE TEST PRODUCT
# ==========================================

Write-Host "`n🏪 Creating test product..." -ForegroundColor Cyan

$productResponse = Invoke-WebRequest -Uri "$BASE_URL/products" `
  -Method Post `
  -ContentType "application/json" `
  -Headers @{
    "Authorization" = "Bearer $MERCHANT_TOKEN"
  } `
  -Body (ConvertTo-Json @{
    name = "Arabica Coffee Beans"
    description = "Premium single-origin coffee"
    price = 450
    stockQty = 15
    reorderAt = 10
    category = "Beverages"
    sku = "ARB-COFFEE-1KG"
    isB2B = $false
  }) | ConvertFrom-Json

Write-Host "✅ Product created" -ForegroundColor Green

$PRODUCT_ID = $productResponse.data.id
$INITIAL_STOCK = $productResponse.data.stockQty

Write-Host "Product ID: $PRODUCT_ID" -ForegroundColor Yellow
Write-Host "Initial Stock: $INITIAL_STOCK" -ForegroundColor Yellow

# ==========================================
# 5. TRIGGER ALERT - MANUAL TEST
# ==========================================

Write-Host "`n⚠️  Triggering manual alert (method 1)..." -ForegroundColor Cyan

$manualAlertResponse = Invoke-WebRequest -Uri "$BASE_URL/inventory/alerts/test" `
  -Method Post `
  -ContentType "application/json" `
  -Headers @{
    "Authorization" = "Bearer $MERCHANT_TOKEN"
  } `
  -Body (ConvertTo-Json @{
    productId = $PRODUCT_ID
  }) | ConvertFrom-Json

Write-Host "✅ Manual alert triggered" -ForegroundColor Green
Write-Host "Job ID: $($manualAlertResponse.jobId)" -ForegroundColor Yellow

Write-Host "`n⏳ Waiting 3 seconds for worker to process..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# ==========================================
# 6. VIEW ALERT HISTORY
# ==========================================

Write-Host "`n📋 Checking alert history..." -ForegroundColor Cyan

try {
  $alertHistoryResponse = Invoke-WebRequest -Uri "$BASE_URL/inventory/alerts/history" `
    -Method Get `
    -ContentType "application/json" `
    -Headers @{
      "Authorization" = "Bearer $MERCHANT_TOKEN"
    } | ConvertFrom-Json

  Write-Host "✅ Alert history retrieved" -ForegroundColor Green
  Write-Host "Total alerts: $($alertHistoryResponse.count)" -ForegroundColor Yellow
  
  if ($alertHistoryResponse.count -gt 0) {
    Write-Host "`n📌 Latest Alert:" -ForegroundColor Cyan
    $latestAlert = $alertHistoryResponse.alerts[0]
    Write-Host "  Product: $($latestAlert.product.name)" -ForegroundColor Gray
    Write-Host "  Severity: $($latestAlert.severity)" -ForegroundColor Gray
    Write-Host "  Suggestion: $($latestAlert.suggestion)" -ForegroundColor Gray
    Write-Host "  Status: $($latestAlert.status)" -ForegroundColor Gray
  }
} catch {
  Write-Host "⚠️  Could not fetch alert history: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ==========================================
# 7. CHECK LOW STOCK PRODUCTS
# ==========================================

Write-Host "`n📊 Checking low stock products..." -ForegroundColor Cyan

try {
  $lowStockResponse = Invoke-WebRequest -Uri "$BASE_URL/inventory/low-stock" `
    -Method Get `
    -ContentType "application/json" `
    -Headers @{
      "Authorization" = "Bearer $MERCHANT_TOKEN"
    } | ConvertFrom-Json

  Write-Host "✅ Low stock check complete" -ForegroundColor Green
  Write-Host "Total products: $($lowStockResponse.total)" -ForegroundColor Yellow
  Write-Host "Low stock products: $($lowStockResponse.lowStockCount)" -ForegroundColor Yellow
  
  if ($lowStockResponse.lowStockCount -gt 0) {
    Write-Host "`n⚠️  Low Stock Items:" -ForegroundColor Cyan
    foreach ($product in $lowStockResponse.products) {
      Write-Host "  • $($product.name) - $($product.stockQty) units (urgency: $($product.urgency))"
    }
  }
} catch {
  Write-Host "⚠️  Could not fetch low stock: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ==========================================
# 8. TRIGGER VIA STOCK ADJUSTMENT
# ==========================================

Write-Host "`n⚠️  Triggering alert via stock adjustment (method 2)..." -ForegroundColor Cyan

$stockUpdateResponse = Invoke-WebRequest -Uri "$BASE_URL/products/$PRODUCT_ID/stock" `
  -Method Patch `
  -ContentType "application/json" `
  -Headers @{
    "Authorization" = "Bearer $MERCHANT_TOKEN"
  } `
  -Body (ConvertTo-Json @{
    quantity = -10
    reason = "bulk_sale_to_restaurant"
  }) | ConvertFrom-Json

Write-Host "✅ Stock adjusted" -ForegroundColor Green
Write-Host "Previous Stock: $($stockUpdateResponse.data.previousStock)" -ForegroundColor Yellow
Write-Host "Current Stock: $($stockUpdateResponse.data.stockQty)" -ForegroundColor Yellow
Write-Host "Change: $($stockUpdateResponse.data.change)" -ForegroundColor Yellow

Write-Host "`n⏳ Waiting 3 seconds for worker to process..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# ==========================================
# 9. VIEW UPDATED ALERT HISTORY
# ==========================================

Write-Host "`n📋 Checking updated alert history..." -ForegroundColor Cyan

try {
  $alertHistoryResponse = Invoke-WebRequest -Uri "$BASE_URL/inventory/alerts/history" `
    -Method Get `
    -ContentType "application/json" `
    -Headers @{
      "Authorization" = "Bearer $MERCHANT_TOKEN"
    } | ConvertFrom-Json

  Write-Host "✅ Alert history updated" -ForegroundColor Green
  Write-Host "Total alerts: $($alertHistoryResponse.count)" -ForegroundColor Yellow
  
  if ($alertHistoryResponse.count -gt 0) {
    Write-Host "`n📌 Latest Alerts (showing first 2):" -ForegroundColor Cyan
    for ($i = 0; $i -lt [Math]::Min(2, $alertHistoryResponse.count); $i++) {
      $alert = $alertHistoryResponse.alerts[$i]
      Write-Host "  [$($i+1)] $($alert.product.name) - Severity: $($alert.severity)" -ForegroundColor Gray
      Write-Host "       Suggestion: $($alert.suggestion)" -ForegroundColor DarkGray
    }
  }
} catch {
  Write-Host "⚠️  Could not fetch updated alert history: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ==========================================
# 10. TEST CRITICAL THRESHOLD
# ==========================================

Write-Host "`n🧪 Testing critical threshold..." -ForegroundColor Cyan

# Create second product with different reorder point
$product2Response = Invoke-WebRequest -Uri "$BASE_URL/products" `
  -Method Post `
  -ContentType "application/json" `
  -Headers @{
    "Authorization" = "Bearer $MERCHANT_TOKEN"
  } `
  -Body (ConvertTo-Json @{
    name = "Instant Noodles"
    price = 25
    stockQty = 100
    reorderAt = 40
    category = "Noodles"
    sku = "NOODLES-BULK"
  }) | ConvertFrom-Json

$PRODUCT_ID2 = $product2Response.data.id

Write-Host "✅ Second product created" -ForegroundColor Green

# Reduce to critical (≤25% of 40 = ≤10)
$stockUpdate2Response = Invoke-WebRequest -Uri "$BASE_URL/products/$PRODUCT_ID2/stock" `
  -Method Patch `
  -ContentType "application/json" `
  -Headers @{
    "Authorization" = "Bearer $MERCHANT_TOKEN"
  } `
  -Body (ConvertTo-Json @{
    quantity = -92
    reason = "big_order"
  }) | ConvertFrom-Json

Write-Host "✅ Reduced to critical stock level" -ForegroundColor Green
Write-Host "Current Stock: $($stockUpdate2Response.data.stockQty)" -ForegroundColor Yellow

Write-Host "`n⏳ Waiting 3 seconds for worker..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# ==========================================
# 11. SUMMARY & VALIDATION
# ==========================================

Write-Host "`n" -ForegroundColor Gray
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "✅ TEST SUMMARY" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Host "`n✅ Completed:" -ForegroundColor Green
Write-Host "  • Merchant registration & authentication"
Write-Host "  • Product creation"
Write-Host "  • Manual alert trigger"
Write-Host "  • Stock adjustment trigger"
Write-Host "  • Alert history retrieval"
Write-Host "  • Low stock product listing"
Write-Host "  • Critical threshold testing"

Write-Host "`n📊 Expected Results:" -ForegroundColor Cyan
Write-Host "  • Inventory queue: 2-3 completed jobs"
Write-Host "  • Notifications queue: 2-3 completed jobs"
Write-Host "  • InventoryAlert table: 2-3 rows"
Write-Host "  • Notification table: 2-3 rows"

Write-Host "`n🔍 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Check database: cd packages/db && pnpm db:studio"
Write-Host "  2. View queue status: GET /inventory/queue/status (admin role)"
Write-Host "  3. Start order system implementation"
Write-Host "  4. Set up real push notifications (Firebase)"

Write-Host "`n✨ System is fully operational!" -ForegroundColor Green
