/**
 * Connection Status Component - Supabase
 * Shows Supabase connection status
 */
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { checkAllConnections } from '@/src/utils/checkConnection';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ConnectionStatus() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<{
    supabase: any;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const checkConnections = async () => {
    setLoading(true);
    const result = await checkAllConnections();
    setStatus(result);
    setLoading(false);
  };

  useEffect(() => {
    checkConnections();
  }, []);

  if (!status) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.white, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Connection Status</Text>
        <TouchableOpacity onPress={checkConnections} disabled={loading}>
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <Ionicons
          name={status.supabase.configured ? 'checkmark-circle' : 'close-circle'}
          size={20}
          color={status.supabase.configured ? colors.success : colors.error}
        />
        <Text style={[styles.statusText, { color: colors.text }]}>
          Supabase: {status.supabase.configured ? 'Connected' : 'Not Configured'}
        </Text>
      </View>

      {status.supabase.database && (
        <View style={styles.statusRow}>
          <Ionicons
            name={status.supabase.database ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={status.supabase.database ? colors.success : colors.error}
          />
          <Text style={[styles.statusText, { color: colors.text }]}>
            Database: {status.supabase.database ? 'Ready' : 'Not Available'}
          </Text>
        </View>
      )}

      {status.supabase.auth && (
        <View style={styles.statusRow}>
          <Ionicons
            name={status.supabase.auth ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={status.supabase.auth ? colors.success : colors.error}
          />
          <Text style={[styles.statusText, { color: colors.text }]}>
            Auth: {status.supabase.auth ? 'Ready' : 'Not Available'}
          </Text>
        </View>
      )}

      {status.supabase.error && (
        <Text style={[styles.error, { color: colors.error }]}>
          {status.supabase.error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    margin: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
  },
  error: {
    fontSize: 12,
    marginTop: 8,
  },
});
