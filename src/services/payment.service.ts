/**
 * Payment service - Stripe customer, payment intent, capture
 */
import { API_ENDPOINTS } from '@/src/config/constants';
import { ServiceResult } from '@/src/types/error.types';
import { apiRequest } from './api-base.service';

export interface CreateCustomerResult {
  stripeCustomerId?: string;
  alreadyExists: boolean;
}

export interface CreateIntentResult {
  clientSecret: string;
  paymentIntentId?: string;
}

export async function createPaymentCustomer(): Promise<ServiceResult<CreateCustomerResult>> {
  return apiRequest<CreateCustomerResult>(API_ENDPOINTS.PAYMENTS_CREATE_CUSTOMER, {
    method: 'POST',
  });
}

export async function createPaymentIntent(sessionId: string): Promise<ServiceResult<CreateIntentResult>> {
  return apiRequest<CreateIntentResult>(API_ENDPOINTS.PAYMENTS_CREATE_INTENT, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function capturePayment(sessionId: string): Promise<ServiceResult<{ success: boolean; status: string }>> {
  return apiRequest<{ success: boolean; status: string }>(API_ENDPOINTS.PAYMENTS_CAPTURE, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}
