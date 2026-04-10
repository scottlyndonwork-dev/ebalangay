import axios from 'axios'

const PAYMONGO_API_URL = process.env.PAYMONGO_API_URL || 'https://api.paymongo.com/v1'
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY || ''

const authHeader = Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64')

const pmAxios = axios.create({
  baseURL: PAYMONGO_API_URL,
  headers: {
    Authorization: `Basic ${authHeader}`,
    'Content-Type': 'application/json',
  },
})

function pmError(error: unknown): never {
  const msg = axios.isAxiosError(error)
    ? (error.response?.data?.errors?.[0]?.detail ?? error.message)
    : String(error)
  throw new Error(`PayMongo error: ${msg}`)
}

export interface PaymentIntent {
  id: string
  attributes: {
    amount: number
    currency: string
    status: string
    checkout_url?: string
    reference_number?: string
    description?: string
    metadata?: Record<string, unknown>
  }
}

export interface CreatePaymentIntentPayload {
  /** Amount in centavos (e.g. 10000 = PHP 100.00) */
  amount: number
  currency: string
  description?: string
  statement_descriptor?: string
  metadata?: Record<string, unknown>
}

/**
 * Create a PayMongo payment intent.
 * PayMongo requires the payload wrapped in { data: { attributes: {...} } }.
 */
export async function createPaymentIntent(
  payload: CreatePaymentIntentPayload
): Promise<PaymentIntent> {
  try {
    const response = await pmAxios.post('/payment_intents', {
      data: {
        attributes: {
          amount: payload.amount,
          currency: payload.currency,
          payment_method_allowed: ['gcash', 'paymaya', 'card', 'dob'],
          description: payload.description,
          statement_descriptor: payload.statement_descriptor,
          metadata: payload.metadata,
        },
      },
    })
    return response.data.data as PaymentIntent
  } catch (error) {
    pmError(error)
  }
}

/**
 * Retrieve a payment intent by ID.
 */
export async function getPaymentIntent(intentId: string): Promise<PaymentIntent> {
  try {
    const response = await pmAxios.get(`/payment_intents/${intentId}`)
    return response.data.data as PaymentIntent
  } catch (error) {
    pmError(error)
  }
}

export interface TransferPayload {
  /** Amount in centavos */
  amount: number
  currency: string
  sendTo: { type: 'gcash' | 'paymaya'; mobileNumber: string }
  remarks?: string
}

export interface Transfer {
  id: string
  attributes: { amount: number; currency: string; status: string }
}

/**
 * Send money to a GCash / Maya account via PayMongo Transfers.
 */
export async function createTransfer(payload: TransferPayload): Promise<Transfer> {
  try {
    const response = await pmAxios.post('/transfers', {
      data: {
        attributes: {
          amount: payload.amount,
          currency: payload.currency,
          target: {
            type: payload.sendTo.type,
            number: payload.sendTo.mobileNumber,
          },
          remarks: payload.remarks,
        },
      },
    })
    return response.data.data as Transfer
  } catch (error) {
    pmError(error)
  }
}

/**
 * Confirm a payment intent with a payment method.
 */
export async function confirmPayment(
  intentId: string,
  paymentMethodId: string
): Promise<{ success: boolean }> {
  try {
    const response = await pmAxios.post(
      `/payment_intents/${intentId}/confirm`,
      {
        data: {
          attributes: {
            payment_method: paymentMethodId,
          },
        },
      }
    )
    return {
      success: response.data.data.attributes.status === 'succeeded',
    }
  } catch (error) {
    pmError(error)
  }
}
