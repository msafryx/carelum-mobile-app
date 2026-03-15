/**
 * Wraps StripeProvider + PaymentSheetPresenter. Only loaded when not in Expo Go
 * (lazy-loaded from session screen) to avoid OnrampSdk crash in Expo Go.
 */
import { StripeProvider } from '@stripe/stripe-react-native';
import React from 'react';
import PaymentSheetPresenter from './PaymentSheetPresenter';

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

interface PaymentSheetFlowProps {
  clientSecret: string;
  merchantDisplayName?: string;
  onSuccess: () => void;
  onCancel: () => void;
  onError?: (message: string) => void;
}

export default function PaymentSheetFlow({
  clientSecret,
  merchantDisplayName,
  onSuccess,
  onCancel,
  onError,
}: PaymentSheetFlowProps) {
  if (!publishableKey) {
    onError?.('Stripe is not configured');
    onCancel();
    return null;
  }
  return (
    <StripeProvider publishableKey={publishableKey}>
      <PaymentSheetPresenter
        clientSecret={clientSecret}
        merchantDisplayName={merchantDisplayName}
        onSuccess={onSuccess}
        onCancel={onCancel}
        onError={onError}
      />
    </StripeProvider>
  );
}
