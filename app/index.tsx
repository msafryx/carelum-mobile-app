import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import LoadingSpinner from '@/src/components/ui/LoadingSpinner';
import ErrorBoundary from '@/src/components/ui/ErrorBoundary';
import { USER_ROLES } from '@/src/config/constants';

export default function RootIndex() {
  const { user, userProfile, loading, initialized } = useAuth();

  if (!initialized || loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user || !userProfile) {
    return <Redirect href="/(auth)/login" />;
  }

  // Route based on user role
  switch (userProfile.role) {
    case USER_ROLES.PARENT:
      return <Redirect href="/(parent)/home" />;
    case USER_ROLES.BABYSITTER:
      return <Redirect href="/(sitter)/home" />;
    case USER_ROLES.ADMIN:
      return <Redirect href="/(admin)/home" />;
    default:
      return <Redirect href="/(auth)/login" />;
  }
}
