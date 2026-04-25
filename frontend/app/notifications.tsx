import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8001/api';

type Notification = {
  alert_id: string;
  product_name: string;
  found_price: number;
  target_price: number;
  merchant: string;
  triggered_at: string;
};

const formatPrice = (p: number) => `$${p.toFixed(2)}`;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts/notifications`);
      const data = await res.json();
      setNotifs(data.notifications ?? []);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00B87C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F1B0F" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alert History</Text>
        <Text style={styles.headerSub}>{notifs.length} notification{notifs.length !== 1 ? 's' : ''} sent</Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#00B87C" />
        }
        showsVerticalScrollIndicator={false}
      >
        {notifs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No alerts fired yet</Text>
            <Text style={styles.emptyBody}>
              When a watched product drops below your target price, you'll see the notification history here.
            </Text>
          </View>
        ) : (
          notifs.map((n, i) => {
            const savings = n.target_price - n.found_price;
            return (
              <View key={`${n.alert_id}-${i}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.dealDot} />
                  <Text style={styles.cardTitle} numberOfLines={2}>{n.product_name}</Text>
                  <Text style={styles.cardTime}>{formatDate(n.triggered_at)}</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.priceChip}>
                    <Text style={styles.priceChipLabel}>Found</Text>
                    <Text style={styles.priceChipValue}>{formatPrice(n.found_price)}</Text>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                  <View style={styles.priceChip}>
                    <Text style={styles.priceChipLabel}>Target</Text>
                    <Text style={styles.priceChipValueMuted}>{formatPrice(n.target_price)}</Text>
                  </View>
                  {savings > 0 && (
                    <View style={[styles.priceChip, styles.savingsChip]}>
                      <Text style={styles.priceChipLabel}>Saved</Text>
                      <Text style={styles.savingsValue}>{formatPrice(savings)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.merchant}>📍 {n.merchant}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1B0F' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F1B0F' },
  header: {
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: '#0F1B0F',
  },
  headerTitle: { color: '#F2F0EC', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  headerSub: { color: '#6B8C6B', fontSize: 13, marginTop: 2 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  card: {
    backgroundColor: '#1A2E1A', borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#2A3E2A',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  dealDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00B87C', marginTop: 5 },
  cardTitle: { flex: 1, color: '#F2F0EC', fontSize: 15, fontWeight: '600', lineHeight: 20 },
  cardTime: { color: '#6B8C6B', fontSize: 11 },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },

  priceChip: { backgroundColor: '#0F1B0F', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  priceChipLabel: { color: '#6B8C6B', fontSize: 10, marginBottom: 1 },
  priceChipValue: { color: '#00B87C', fontSize: 16, fontWeight: '700' },
  priceChipValueMuted: { color: '#A8C8A8', fontSize: 16, fontWeight: '600' },
  savingsChip: { backgroundColor: '#00B87C22' },
  savingsValue: { color: '#00B87C', fontSize: 15, fontWeight: '700' },
  arrow: { color: '#6B8C6B', fontSize: 14 },

  merchant: { color: '#6B8C6B', fontSize: 12 },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#F2F0EC', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyBody: { color: '#6B8C6B', fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
