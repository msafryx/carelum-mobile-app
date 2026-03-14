/**
 * Sitter payout account - Stripe Connect onboarding
 */
import { API_ENDPOINTS } from '@/src/config/constants';
import { ServiceResult } from '@/src/types/error.types';
import { apiRequest } from './api-base.service';

export interface CreateStripeAccountResult {
  accountId?: string;
  alreadyExists: boolean;
}

export interface OnboardingLinkResult {
  url: string;
}

export async function createStripeAccount(): Promise<ServiceResult<CreateStripeAccountResult>> {
  return apiRequest<CreateStripeAccountResult>(API_ENDPOINTS.SITTERS_CREATE_STRIPE_ACCOUNT, {
    method: 'POST',
  });
}

export async function getOnboardingLink(): Promise<ServiceResult<OnboardingLinkResult>> {
  return apiRequest<OnboardingLinkResult>(API_ENDPOINTS.SITTERS_ONBOARDING_LINK, {
    method: 'POST',
  });
}
