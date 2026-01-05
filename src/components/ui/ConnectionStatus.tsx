/**
 * Connection Status Component
 * Shows Firebase and Local DB connection status
 */
import { useTheme } from '@/src/config/theme';
import { checkAllConnections } from '@/src/utils/checkConnection';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ConnectionStatus() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<{
    firebase: any;
    localDB: any;
    sync: any;
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
          name={status.firebase.configured ? 'checkmark-circle' : 'close-circle'}
          size={20}
          color={status.firebase.configured ? colors.success : colors.error}
        />
        <Text style={[styles.statusText, { color: colors.text }]}>
          Firebase: {status.firebase.configured ? 'Connected' : 'Not Configured'}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Ionicons
          name={status.localDB.initialized ? 'checkmark-circle' : 'close-circle'}
          size={20}
          color={status.localDB.initialized ? colors.success : colors.error}
        />
        <Text style={[styles.statusText, { color: colors.text }]}>
          Local DB: {status.localDB.initialized ? 'Ready' : 'Not Initialized'}
        </Text>
      </View>

      {status.sync && (
        <View style={styles.statusRow}>
          <Ionicons
            name={status.sync.status === 'synced' ? 'checkmark-circle' : 'alert-circle'}
            size={20}
            color={status.sync.status === 'synced' ? colors.success : colors.warning}
          />
          <Text style={[styles.statusText, { color: colors.text }]}>
            Sync: {status.sync.unsyncedSessions} pending
          </Text>
        </View>
      )}

      {status.firebase.error && (
        <Text style={[styles.error, { color: colors.error }]}>
          {status.firebase.error}
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
