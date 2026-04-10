// ─── Base fetch wrapper ───────────────────────────────────────────────────────

const BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL)
  || (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL)
  || 'http://localhost:3001'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  }

  const res = await fetch(BASE + path, { ...options, headers })
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(res.status, json.error ?? json.message ?? 'Request failed')
  }
  return json.data as T
}

// ─── Domain types (subset — full types live in @ebalangay/shared/types) ───────

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface User {
  id: string
  name: string
  email?: string
  phone: string
  role: string
  isVerified: boolean
  avatarUrl?: string
  business?: Business
  riderProfile?: RiderProfile
}

export interface Business {
  id: string
  ownerId: string
  name: string
  type: string
  barangay: string
  city: string
  logoUrl?: string
  isVerified: boolean
  canSellB2B: boolean
  payoutGcash?: string
  lat?: number
  lng?: number
}

export interface RiderProfile {
  id: string
  gcashNumber: string
  vehicleType: string
  isVerified: boolean
}

export interface Product {
  id: string
  businessId: string
  merchantId: string
  merchantName?: string
  name: string
  description?: string
  sku?: string
  price: number
  stockQty: number
  reorderAt: number
  category: string
  imageUrl?: string
  isActive: boolean
  isB2B: boolean
  featured?: boolean
}

export interface Order {
  id: string
  customerId: string
  merchantId: string
  merchantName?: string
  status: string
  subtotal: number
  deliveryFee: number
  commission: number
  totalAmount: number
  total: number
  isB2B: boolean
  addressLine: string
  barangay: string
  deliveryAddress?: string
  pickupAddress?: string
  notes?: string
  placedAt: string
  riderName?: string
  customerPhone?: string
  items: OrderItem[]
  delivery?: Delivery
  payment?: Payment
  customer?: { name: string; phone: string }
  merchant?: Business
}

export interface OrderItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  product?: Product
}

export interface Delivery {
  id: string
  orderId: string
  riderId?: string
  status: string
  pickupLat: number
  pickupLng: number
  dropoffLat: number
  dropoffLng: number
  deliveredAt?: string
  proofPhotoUrl?: string
}

export interface Payment {
  id: string
  status: string
  amount: number
  intentId?: string
  paidAt?: string
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  status: string
  sentAt: string
  readAt?: string
}

export interface MerchantDashboard {
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  lowStockCount: number
  dailyRevenue: Array<{ date: string; revenue: number }>
  topProducts: Array<{ name: string; totalSold: number }>
}

export interface Merchant extends Business {
  isOpen?: boolean
  logoUrl?: string
}

export interface RiderStats {
  todayDeliveries: number
  todayEarnings: number
}

export interface RiderEarnings {
  totalEarnings: number
  totalDeliveries: number
  payouts: Array<{ date: string; deliveries: number; amount: number }>
}

export interface AdminDashboard {
  gmv: number
  totalOrders: number
  activeRiders: number
  totalMerchants: number
  revenueByStream: Array<{ name: string; value: number }>
}

export interface LiveDelivery {
  orderId: string
  riderId: string
  riderName: string
  lat: number
  lng: number
  status: string
}

export interface InventoryAlert {
  id: string
  productId: string
  businessId: string
  currentStock: number
  reorderAt: number
  severity: string
  suggestion?: string
  status: string
  product: Product
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function authRegister(body: {
  phone: string
  name: string
  role: string
  password?: string
  email?: string
}): Promise<{ userId: string }> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(body) })
}

async function authVerifyOtp(body: { userId: string; otp: string }): Promise<AuthTokens & { user: User }> {
  return request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) })
}

async function authLogin(body: {
  phone: string
  password: string
}): Promise<AuthTokens & { user: User }> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(body) })
}

async function authRefresh(refreshToken: string): Promise<AuthTokens> {
  return request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
}

async function authLogout(token: string, refreshToken: string): Promise<void> {
  return request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  }, token)
}

async function authMe(token: string): Promise<User> {
  return request('/auth/me', {}, token)
}

// ─── Products ─────────────────────────────────────────────────────────────────

async function productsList(params?: {
  businessId?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}, token?: string): Promise<{ products: Product[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.businessId) qs.set('businessId', params.businessId)
  if (params?.category) qs.set('category', params.category)
  if (params?.search) qs.set('search', params.search)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const q = qs.toString()
  return request(`/products${q ? `?${q}` : ''}`, {}, token)
}

async function productsGet(id: string, token?: string): Promise<Product> {
  return request(`/products/${id}`, {}, token)
}

async function productsCreate(body: Partial<Product>, token: string): Promise<Product> {
  return request('/products', { method: 'POST', body: JSON.stringify(body) }, token)
}

async function productsUpdate(id: string, body: Partial<Product>, token: string): Promise<Product> {
  return request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token)
}

async function productsDel(id: string, token: string): Promise<void> {
  return request(`/products/${id}`, { method: 'DELETE' }, token)
}

async function productsUploadImage(
  id: string,
  formData: FormData,
  token: string
): Promise<{ imageUrl: string }> {
  const res = await fetch(`${BASE}/products/${id}/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const json = await res.json()
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'Upload failed')
  return json.data
}

// ─── Inventory ────────────────────────────────────────────────────────────────

async function inventoryAlerts(token: string): Promise<InventoryAlert[]> {
  return request('/inventory/alerts', {}, token)
}

async function inventoryUpdateStock(
  productId: string,
  stockQty: number,
  token: string
): Promise<Product> {
  return request(`/inventory/${productId}/stock`, {
    method: 'PATCH',
    body: JSON.stringify({ stockQty }),
  }, token)
}

// ─── Orders ───────────────────────────────────────────────────────────────────

async function ordersList(params?: {
  status?: string
  page?: number
  limit?: number
}, token?: string): Promise<{ orders: Order[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const q = qs.toString()
  return request(`/orders${q ? `?${q}` : ''}`, {}, token)
}

async function ordersGet(id: string, token: string): Promise<Order> {
  return request(`/orders/${id}`, {}, token)
}

async function ordersCreate(body: {
  merchantId: string
  addressLine: string
  barangay: string
  notes?: string
  items: Array<{ productId: string; quantity: number }>
  paymentMethodId?: string
}, token: string): Promise<Order & { paymentIntent?: { id: string; checkout_url?: string } }> {
  return request('/orders', { method: 'POST', body: JSON.stringify(body) }, token)
}

async function ordersUpdateStatus(
  id: string,
  status: string,
  token: string
): Promise<Order> {
  return request(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token)
}

async function ordersCancel(id: string, token: string): Promise<Order> {
  return request(`/orders/${id}/cancel`, { method: 'POST' }, token)
}

// ─── Deliveries ───────────────────────────────────────────────────────────────

async function deliveriesGet(id: string, token: string): Promise<Delivery> {
  return request(`/deliveries/${id}`, {}, token)
}

async function deliveriesPickup(id: string, token: string): Promise<Delivery> {
  return request(`/deliveries/${id}/pickup`, { method: 'POST' }, token)
}

async function deliveriesComplete(
  id: string,
  formData: FormData,
  token: string
): Promise<Delivery> {
  const res = await fetch(`${BASE}/deliveries/${id}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const json = await res.json()
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'Complete failed')
  return json.data
}

// ─── Riders ───────────────────────────────────────────────────────────────────

async function ridersSetAvailability(
  available: boolean,
  barangay: string,
  token: string
): Promise<void> {
  return request('/riders/availability', {
    method: 'POST',
    body: JSON.stringify({ available, barangay }),
  }, token)
}

async function ridersGetEarnings(token: string): Promise<{
  todayEarnings: number
  weekEarnings: number
  totalEarnings: number
  deliveries: Array<{ orderId: string; amount: number; date: string }>
}> {
  return request('/riders/earnings', {}, token)
}

// ─── Analytics ────────────────────────────────────────────────────────────────

async function merchantsList(params?: {
  barangay?: string
  search?: string
}, token?: string): Promise<Merchant[]> {
  const qs = new URLSearchParams()
  if (params?.barangay) qs.set('barangay', params.barangay)
  if (params?.search) qs.set('search', params.search)
  const q = qs.toString()
  return request(`/merchants${q ? `?${q}` : ''}`, {}, token)
}

async function ordersAcceptDelivery(id: string, token: string): Promise<Order> {
  return request(`/orders/${id}/accept`, { method: 'POST' }, token)
}

async function ordersDeclineDelivery(id: string, token: string): Promise<void> {
  return request(`/orders/${id}/decline`, { method: 'POST' }, token)
}

async function ordersSubmitProofOfDelivery(
  orderId: string,
  formData: FormData,
  token: string
): Promise<Delivery> {
  const res = await fetch(`${BASE}/orders/${orderId}/proof`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const json = await res.json()
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'Upload failed')
  return json.data
}

async function analyticsGetRiderStats(token: string): Promise<RiderStats> {
  return request('/analytics/rider/stats', {}, token)
}

async function analyticsGetRiderEarnings(token: string): Promise<RiderEarnings> {
  return request('/analytics/rider/earnings', {}, token)
}

async function analyticsGetMerchantDashboard(token: string): Promise<MerchantDashboard> {
  return request('/analytics/merchant/dashboard', {}, token)
}

async function analyticsGetAdminDashboard(token: string): Promise<AdminDashboard> {
  return request('/analytics/admin/dashboard', {}, token)
}

async function analyticsGetLiveDeliveries(token: string): Promise<LiveDelivery[]> {
  return request('/analytics/live-deliveries', {}, token)
}

// ─── AI ───────────────────────────────────────────────────────────────────────

async function aiGetDescription(
  name: string,
  category: string,
  price: number,
  token: string
): Promise<string> {
  const res = await request<{ description: string }>(
    '/ai/product-description',
    { method: 'POST', body: JSON.stringify({ name, category, price }) },
    token
  )
  return res.description
}

async function aiGetRestockSuggestions(token: string): Promise<
  Array<{ productId: string; name: string; stockQty: number; suggestion: string }>
> {
  const res = await request<{ suggestions: Array<{ productId: string; name: string; stockQty: number; suggestion: string }> }>(
    '/ai/restock-suggestions',
    {},
    token
  )
  return res.suggestions
}

// Chat uses SSE — returns EventSource URL + headers, handled in the component
function aiChatUrl(): string {
  return `${BASE}/ai/chat`
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function notificationsRegisterToken(fcmToken: string, accessToken: string): Promise<void> {
  return request('/notifications/register-token', {
    method: 'POST',
    body: JSON.stringify({ token: fcmToken }),
  }, accessToken)
}

// ─── Businesses ───────────────────────────────────────────────────────────────

async function businessesList(params?: {
  barangay?: string
  type?: string
  search?: string
}, token?: string): Promise<Business[]> {
  const qs = new URLSearchParams()
  if (params?.barangay) qs.set('barangay', params.barangay)
  if (params?.type) qs.set('type', params.type)
  if (params?.search) qs.set('search', params.search)
  const q = qs.toString()
  return request(`/businesses${q ? `?${q}` : ''}`, {}, token)
}

async function businessesGet(id: string, token?: string): Promise<Business> {
  return request(`/businesses/${id}`, {}, token)
}

async function businessesUpdate(
  id: string,
  body: Partial<Business>,
  token: string
): Promise<Business> {
  return request(`/businesses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }, token)
}

// ─── Users (admin) ───────────────────────────────────────────────────────────

async function usersList(params?: {
  role?: string
  search?: string
  page?: number
}, token?: string): Promise<{ users: User[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.role) qs.set('role', params.role)
  if (params?.search) qs.set('search', params.search)
  if (params?.page) qs.set('page', String(params.page))
  return request(`/auth/users?${qs.toString()}`, {}, token)
}

// ─── Assembled API client ─────────────────────────────────────────────────────

export const api = {
  auth: {
    register: authRegister,
    verifyOtp: authVerifyOtp,
    login: authLogin,
    refresh: authRefresh,
    logout: authLogout,
    me: authMe,
  },
  products: {
    list: productsList,
    get: productsGet,
    create: productsCreate,
    update: productsUpdate,
    delete: productsDel,
    uploadImage: productsUploadImage,
  },
  inventory: {
    alerts: inventoryAlerts,
    updateStock: inventoryUpdateStock,
  },
  orders: {
    list: ordersList,
    get: ordersGet,
    create: ordersCreate,
    updateStatus: ordersUpdateStatus,
    cancel: ordersCancel,
    acceptDelivery: ordersAcceptDelivery,
    declineDelivery: ordersDeclineDelivery,
    submitProofOfDelivery: ordersSubmitProofOfDelivery,
  },
  merchants: {
    list: merchantsList,
  },
  deliveries: {
    get: deliveriesGet,
    pickup: deliveriesPickup,
    complete: deliveriesComplete,
  },
  riders: {
    setAvailability: ridersSetAvailability,
    getEarnings: ridersGetEarnings,
  },
  analytics: {
    getMerchantDashboard: analyticsGetMerchantDashboard,
    getAdminDashboard: analyticsGetAdminDashboard,
    getLiveDeliveries: analyticsGetLiveDeliveries,
    getRiderStats: analyticsGetRiderStats,
    getRiderEarnings: analyticsGetRiderEarnings,
  },
  ai: {
    getDescription: aiGetDescription,
    chatUrl: aiChatUrl,
    getRestockSuggestions: aiGetRestockSuggestions,
  },
  notifications: {
    registerToken: notificationsRegisterToken,
  },
  businesses: {
    list: businessesList,
    get: businessesGet,
    update: businessesUpdate,
  },
  users: {
    list: usersList,
  },
}
