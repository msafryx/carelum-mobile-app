/**
 * Parent: list of sent meeting requests (video call before booking). Join when accepted.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import { listMeetingRequests, MeetingRequest } from '@/src/services/meeting-request.service';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';

export default function ParentMeetingRequestsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [list, setList] = useState<MeetingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const res = await listMeetingRequests('parent');
    if (res.success && res.data) setList(res.data);
    else setList([]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleJoin = async (req: MeetingRequest) => {
    let url = (req.meeting_link || '').trim();
    if (!url || url.includes('placeholder')) {
      if (req.status === 'accepted' && req.id) {
        const room = 'carelum-' + req.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
        url = `https://meet.jit.si/${room}`;
      } else {
        Alert.alert('No meeting link', 'Ask the sitter to accept the request first.');
        return;
      }
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (e: any) {
      Alert.alert('Could not open meeting', e?.message || 'Try opening the link in your browser.');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Meeting requests" showBack showLogo={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}
      >
        {loading ? (
          <Card>
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </Card>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon="videocam-outline"
              title="No meeting requests"
              message="When you request a video call from a sitter's profile (Find Babysitter), they will appear here. After the sitter accepts, you can join the call."
            />
          </Card>
        ) : (
          list.map((req) => (
            <Card key={req.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={[styles.sitterName, { color: colors.text }]}>
                    {req.sitter_display_name || 'Sitter'}
                  </Text>
                  <Text style={[styles.status, { color: colors.textSecondary }]}>
                    Status: {req.status}
                  </Text>
                  {req.scheduled_time && (
                    <Text style={[styles.time, { color: colors.textSecondary }]}>
                      {format(new Date(req.scheduled_time), 'MMM d, yyyy, h:mm a')}
                    </Text>
                  )}
                </View>
                {req.status === 'accepted' && req.meeting_link && (
                  <TouchableOpacity
                    style={[styles.joinBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleJoin(req)}
                  >
                    <Ionicons name="videocam" size={18} color="#fff" />
                    <Text style={styles.joinBtnText}>Join</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  loading: { paddingVertical: 24, alignItems: 'center' },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { flex: 1 },
  sitterName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  status: { fontSize: 13, marginBottom: 2 },
  time: { fontSize: 13 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  joinBtnText: { color: '#fff', fontWeight: '600' },
});
