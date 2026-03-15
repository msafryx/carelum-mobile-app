/**
 * Presents Stripe Payment Sheet when parent taps "Confirm and Pay".
 */
import { usePaymentSheet } from '@stripe/stripe-react-native';
import React, { useEffect, useRef } from 'react';

interface PaymentSheetPresenterProps {
  clientSecret: string;
  merchantDisplayName?: string;
  onSuccess: () => void;
  onCancel: () => void;
  onError?: (message: string) => void;
}

export default function PaymentSheetPresenter({
  clientSecret,
  merchantDisplayName = 'Carelum',
  onSuccess,
  onCancel,
  onError,
}: PaymentSheetPresenterProps) {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const initDone = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  const onCancelRef = useRef(onCancel);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onCancelRef.current = onCancel;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!clientSecret || initDone.current) return;

    let cancelled = false;
    (async () => {
      try {
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName,
        });
        if (cancelled) return;
        if (initError) {
          onErrorRef.current?.(initError.message || 'Failed to initialize payment');
          onCancelRef.current();
          return;
        }
        initDone.current = true;
        const { error: presentError } = await presentPaymentSheet();
        if (cancelled) return;
        if (presentError) {
          if (presentError.code === 'Canceled') {
            onCancelRef.current();
          } else {
            onErrorRef.current?.(presentError.message || 'Payment failed');
            onCancelRef.current();
          }
          return;
        }
        onSuccessRef.current();
      } catch (e: any) {
        if (!cancelled) {
          onErrorRef.current?.(e?.message || 'Payment error');
          onCancelRef.current();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientSecret, merchantDisplayName, initPaymentSheet, presentPaymentSheet]);

  return null;
}
