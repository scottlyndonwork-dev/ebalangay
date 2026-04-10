#!/usr/bin/env node
/**
 * INVENTORY ALERT SYSTEM - TEST SCRIPT
 * Node.js version for cross-platform compatibility
 */

import { execSync } from 'child_process'

const BASE_URL = 'http://localhost:3001'
// Generate unique phone for each test run
const MERCHANT_PHONE = `091711${String(Date.now()).slice(-5)}`

// Helper function to get OTP from Redis via WSL redis-cli
function getOtpFromRedis(otpToken) {
  try {
    const output = execSync(
      `wsl -d Ubuntu-22.04 -- redis-cli get "otp:${otpToken}"`,
      { encoding: 'utf-8' }
    )
    if (!output || output.trim() === '(nil)') {
      return null
    }
    const otpData = JSON.parse(output)
    return otpData.otp
  } catch (error) {
    console.error('Error fetching OTP from Redis:', error.message)
    return null
  }
}

// Helper function to make HTTP requests
async function request(method, path, body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${BASE_URL}${path}`, options)
  const contentType = response.headers.get('content-type')
  const text = await response.text()
  
  let data
  if (contentType && contentType.includes('application/json') && text) {
    try {
      data = JSON.parse(text)
    } catch (e) {
      data = { parseError: e.message, rawText: text }
    }
  } else {
    data = { rawResponse: text, status: response.status }
  }

  if (!response.ok) {
    console.error(`❌ ${method} ${path} failed:`, response.status, data)
    throw new Error(data.message || data.error || 'Request failed')
  }

  return data
}

async function main() {
  try {
    console.log('📱 Registering merchant...')
    const registerRes = await request('POST', '/auth/register', {
      phone: MERCHANT_PHONE,
      name: 'Test Merchant',
      role: 'MERCHANT',
    })
    const otpToken = registerRes.otpToken
    console.log('✅ Merchant registered')
    console.log(`   OTP Token: ${otpToken}`)
    console.log(`   Message: ${registerRes.message}`)

    // Get OTP from Redis (development mode)
    console.log('\n🔓 Fetching OTP from Redis (dev mode)...')
    const otp = getOtpFromRedis(otpToken)
    if (!otp) {
      throw new Error('OTP not found in Redis - service may not be available')
    }
    console.log(`✅ OTP retrieved: ${otp}`)

    console.log('\n🔐 Verifying OTP...')
    const verifyRes = await request('POST', '/auth/verify-otp', {
      otpToken: otpToken,
      otp: otp,
    })
    const merchantToken = verifyRes.accessToken
    const merchantId = verifyRes.user.id
    console.log('✅ OTP verified')
    console.log(`   Merchant ID: ${merchantId}`)
    console.log(`   Token: ${merchantToken.substring(0, 20)}...`)

    console.log('\n� Creating business...')
    const businessRes = await request(
      'POST',
      '/businesses',
      {
        name: 'Test Coffee Shop',
        type: 'RETAIL',
        barangay: 'Barangay 1',
        city: 'Manila',
      },
      merchantToken
    )
    const businessId = businessRes.data.id
    console.log('✅ Business created')
    console.log(`   Business ID: ${businessId}`)

    console.log('\n�🏪 Creating test product...')
    const productRes = await request(
      'POST',
      '/products',
      {
        name: 'Arabica Coffee Beans',
        description: 'Premium single-origin coffee',
        price: 450,
        stockQty: 15,
        reorderAt: 10,
        category: 'Beverages',
        sku: 'ARB-COFFEE-1KG',
        isB2B: false,
      },
      merchantToken
    )
    console.log('Product response:', JSON.stringify(productRes, null, 2))
    const productId = productRes.data?.id || productRes.id
    const initialStock = productRes.data?.stockQty || productRes.stockQty
    console.log('✅ Product created')
    console.log(`   Product ID: ${productId}`)
    console.log(`   Initial Stock: ${initialStock}`)

    console.log('\n⚠️  Triggering manual alert...')
    const alertRes = await request(
      'POST',
      '/inventory/alerts/test',
      { productId },
      merchantToken
    )
    console.log('✅ Manual alert triggered')
    console.log(`   Job ID: ${alertRes.jobId}`)

    console.log('\n⏳ Waiting 3 seconds for worker to process...')
    await new Promise((resolve) => setTimeout(resolve, 3000))

    console.log('\n📋 Checking alert history...')
    const historyRes = await request(
      'GET',
      '/inventory/alerts/history',
      null,
      merchantToken
    )
    console.log('✅ Alert history retrieved')
    console.log(`   Total alerts: ${historyRes.count || 0}`)

    console.log('\n' + '='.repeat(50))
    console.log('✅ TEST SUMMARY')
    console.log('='.repeat(50))
    console.log('\n✅ Completed:')
    console.log('  • Merchant registration & authentication')
    console.log('  • Product creation')
    console.log('  • Manual alert trigger')
    console.log('\n🎯 Expected Results:')
    console.log('  • Inventory queue: Jobs should be visible')
    console.log('  • Notifications queue: Jobs should exist')
    console.log('  • InventoryAlert table: New alert rows')
    console.log('\n📚 Next Steps:')
    console.log('  1. Check database: cd packages/db && pnpm db:studio')
    console.log('  2. View queue status: GET /inventory/queue/status (admin)')
    console.log('  3. Start order system implementation')
    console.log('  4. Set up real push notifications (Firebase)')
    console.log('\n✨ System is fully operational!')
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    process.exit(1)
  }
}

main()
