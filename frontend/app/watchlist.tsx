import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8001/api';

// ── Types ────────────────────────────────────────────────────────────────────
type PriceAlert = {
  id: string;
  product_name: string;
  postal_code: string;
  target_price: number;
  notify_email: string | null;
  active: boolean;
  created_at: string;
  last_seen_price: number | null;
  last_checked_at: string | null;
  last_triggered_at: string | null;
  best_merchant: string | null;
};

type NewAlert = {
  product_name: string;
  postal_code: string;
  target_price: string;
  notify_email: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatPrice = (p: number | null) =>
  p != null ? `$${p.toFixed(2)}` : '—';

const timeSince = (iso: string | null) => {
  if (!iso) return 'Never';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

// ── API ───────────────────────────────────────────────────────────────────────
const api = {
  async getAlerts(): Promise<PriceAlert[]> {
    const res = await fetch(`${API_BASE}/alerts`);
    const data = await res.json();
    return data.alerts ?? [];
  },
  async createAlert(payload: Omit<NewAlert, 'target_price'> & { target_price: number }) {
    const res = await fetch(`${API_BASE}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  async toggleAlert(id: string, active: boolean) {
    await fetch(`${API_BASE}/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
  },
  async deleteAlert(id: string) {
    await fetch(`${API_BASE}/alerts/${id}`, { method: 'DELETE' });
  },
  async triggerCheck() {
    const res = await fetch(`${API_BASE}/alerts/check`, { method: 'POST' });
    return res.json();
  },
};

// ── AlertCard ─────────────────────────────────────────────────────────────────
function AlertCard({
  alert,
  onToggle,
  onDelete,
}: {
  alert: PriceAlert;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const dealFound =
    alert.last_seen_price != null && alert.last_seen_price <= alert.target_price;
  const aboveTarget =
    alert.last_seen_price != null && alert.last_seen_price > alert.target_price;

  return (
    <View style={[styles.card, !alert.active && styles.cardInactive]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {alert.product_name}
        </Text>
        <View style={[styles.badge, dealFound ? styles.badgeDeal : aboveTarget ? styles.badgeWaiting : styles.badgeNew]}>
          <Text style={styles.badgeText}>
            {dealFound ? 'DEAL FOUND' : aboveTarget ? 'WATCHING' : 'NEW'}
          </Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>Target</Text>
          <Text style={styles.priceTarget}>{formatPrice(alert.target_price)}</Text>
        </View>
        <View style={styles.priceDivider} />
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>Current best</Text>
          <Text style={[styles.priceCurrent, dealFound && styles.priceDeal]}>
            {formatPrice(alert.last_seen_price)}
          </Text>
        </View>
        {alert.best_merchant ? (
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>Store</Text>
            <Text style={styles.priceMerchant} numberOfLines={1}>
              {alert.best_merchant}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>📍 {alert.postal_code}</Text>
        <Text style={styles.metaText}>🕐 {timeSince(alert.last_checked_at)}</Text>
        {alert.notify_email ? (
          <Text style={styles.metaText} numberOfLines={1}>✉️ {alert.notify_email}</Text>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, alert.active ? styles.actionPause : styles.actionResume]}
          onPress={() => onToggle(alert.id, !alert.active)}
        >
          <Text style={styles.actionBtnText}>{alert.active ? 'Pause' : 'Resume'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionDelete]}
          onPress={() =>
            Alert.alert('Remove alert?', `Stop watching "${alert.product_name}"?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => onDelete(alert.id) },
            ])
          }
        >
          <Text style={styles.actionBtnText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── AddAlertModal ─────────────────────────────────────────────────────────────
function AddAlertModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (alert: NewAlert) => Promise<void>;
}) {
  const [form, setForm] = useState<NewAlert>({
    product_name: '',
    postal_code: '',
    target_price: '',
    notify_email: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.product_name.trim()) return Alert.alert('Enter a product name');
    if (!form.postal_code.trim()) return Alert.alert('Enter your postal code');
    if (!form.target_price || isNaN(Number(form.target_price)))
      return Alert.alert('Enter a valid target price');
    setSaving(true);
    try {
      await onSave(form);
      setForm({ product_name: '', postal_code: '', target_price: '', notify_email: '' });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Watch a Product</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.inputLabel}>Product name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Organic milk 2L"
            placeholderTextColor="#999"
            value={form.product_name}
            onChangeText={(v) => setForm((f) => ({ ...f, product_name: v }))}
          />

          <Text style={styles.inputLabel}>Postal code *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. L5B 1M4"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            value={form.postal_code}
            onChangeText={(v) => setForm((f) => ({ ...f, postal_code: v }))}
          />

          <Text style={styles.inputLabel}>Alert me when price drops below *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 4.99"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
            value={form.target_price}
            onChangeText={(v) => setForm((f) => ({ ...f, target_price: v }))}
          />

          <Text style={styles.inputLabel}>Email for alerts (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.notify_email}
            onChangeText={(v) => setForm((f) => ({ ...f, notify_email: v }))}
          />

          <Text style={styles.inputHint}>
            💬 Telegram alerts are sent to the configured bot channel automatically.
          </Text>
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Start Watching</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WatchlistScreen() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (e) {
      Alert.alert('Error', 'Could not load watchlist.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleAdd = async (form: NewAlert) => {
    await api.createAlert({
      ...form,
      target_price: parseFloat(form.target_price),
    });
    await loadAlerts();
  };

  const handleToggle = async (id: string, active: boolean) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, active } : a)));
    await api.toggleAlert(id, active);
  };

  const handleDelete = async (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await api.deleteAlert(id);
  };

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const result = await api.triggerCheck();
      Alert.alert(
        'Check complete',
        `Checked ${result.checked} items. ${
          result.fired > 0
            ? `🎉 ${result.fired} deal${result.fired > 1 ? 's' : ''} found!`
            : 'No new deals yet.'
        }`
      );
      await loadAlerts();
    } catch {
      Alert.alert('Error', 'Check failed. Is the server running?');
    } finally {
      setChecking(false);
    }
  };

  const activeAlerts = alerts.filter((a) => a.active);
  const pausedAlerts = alerts.filter((a) => !a.active);
  const dealsFound = alerts.filter(
    (a) => a.last_seen_price != null && a.last_seen_price <= a.target_price
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00B87C" />
        <Text style={styles.loaderText}>Loading watchlist...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F1B0F" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Watchlist</Text>
          <Text style={styles.headerSub}>
            {activeAlerts.length} active · {dealsFound.length} deal{dealsFound.length !== 1 ? 's' : ''} found
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAdd(true)}
        >
          <Text style={styles.addBtnText}>+ Watch</Text>
        </TouchableOpacity>
      </View>

      {/* Check Now bar */}
      <TouchableOpacity
        style={[styles.checkBar, checking && styles.checkBarActive]}
        onPress={handleCheckNow}
        disabled={checking}
      >
        {checking ? (
          <ActivityIndicator size="small" color="#00B87C" />
        ) : (
          <Text style={styles.checkBarText}>🔍 Check prices now</Text>
        )}
        <Text style={styles.checkBarSub}>Auto-checks every 30 min</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadAlerts(); }}
            tintColor="#00B87C"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>No products watched yet</Text>
            <Text style={styles.emptyBody}>
              Tap <Text style={styles.emptyAccent}>+ Watch</Text> to start tracking a product. We'll
              alert you via Telegram and email when the price drops.
            </Text>
          </View>
        ) : (
          <>
            {dealsFound.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>🎉 Deals found</Text>
                {dealsFound.map((a) => (
                  <AlertCard key={a.id} alert={a} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </>
            )}
            {activeAlerts.filter(
              (a) => !(a.last_seen_price != null && a.last_seen_price <= a.target_price)
            ).length > 0 && (
              <>
                <Text style={styles.sectionLabel}>👀 Watching</Text>
                {activeAlerts
                  .filter((a) => !(a.last_seen_price != null && a.last_seen_price <= a.target_price))
                  .map((a) => (
                    <AlertCard key={a.id} alert={a} onToggle={handleToggle} onDelete={handleDelete} />
                  ))}
              </>
            )}
            {pausedAlerts.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>⏸ Paused</Text>
                {pausedAlerts.map((a) => (
                  <AlertCard key={a.id} alert={a} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <AddAlertModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleAdd}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1B0F' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F1B0F', gap: 12 },
  loaderText: { color: '#aaa', fontSize: 14 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: '#0F1B0F',
  },
  headerTitle: { color: '#F2F0EC', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  headerSub: { color: '#6B8C6B', fontSize: 13, marginTop: 2 },
  addBtn: { backgroundColor: '#00B87C', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  checkBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: '#1A2E1A', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: '#2A3E2A',
  },
  checkBarActive: { borderColor: '#00B87C' },
  checkBarText: { color: '#F2F0EC', fontSize: 14, fontWeight: '500' },
  checkBarSub: { color: '#6B8C6B', fontSize: 12 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  sectionLabel: { color: '#6B8C6B', fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8, marginBottom: 8 },

  // Card
  card: {
    backgroundColor: '#1A2E1A', borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#2A3E2A',
  },
  cardInactive: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  cardTitle: { flex: 1, color: '#F2F0EC', fontSize: 16, fontWeight: '600', lineHeight: 22 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeNew: { backgroundColor: '#2A3E2A' },
  badgeWaiting: { backgroundColor: '#1E3060' },
  badgeDeal: { backgroundColor: '#00B87C' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  priceBlock: { flex: 1, alignItems: 'center' },
  priceLabel: { color: '#6B8C6B', fontSize: 11, marginBottom: 2, textAlign: 'center' },
  priceTarget: { color: '#F2F0EC', fontSize: 18, fontWeight: '700' },
  priceCurrent: { color: '#F2F0EC', fontSize: 18, fontWeight: '700' },
  priceDeal: { color: '#00B87C' },
  priceMerchant: { color: '#A8C8A8', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  priceDivider: { width: 1, height: 36, backgroundColor: '#2A3E2A' },

  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metaText: { color: '#6B8C6B', fontSize: 12 },

  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  actionPause: { backgroundColor: '#2A3E2A' },
  actionResume: { backgroundColor: '#1E3060' },
  actionDelete: { backgroundColor: '#3E1A1A' },
  actionBtnText: { color: '#F2F0EC', fontSize: 13, fontWeight: '500' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#F2F0EC', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyBody: { color: '#6B8C6B', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  emptyAccent: { color: '#00B87C', fontWeight: '600' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0F1B0F' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#2A3E2A',
  },
  modalTitle: { color: '#F2F0EC', fontSize: 20, fontWeight: '700' },
  modalClose: { padding: 4 },
  modalCloseText: { color: '#6B8C6B', fontSize: 20 },
  modalBody: { flex: 1, padding: 20 },
  inputLabel: { color: '#A8C8A8', fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#1A2E1A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#F2F0EC', fontSize: 15, borderWidth: 1, borderColor: '#2A3E2A',
  },
  inputHint: { color: '#6B8C6B', fontSize: 12, marginTop: 20, lineHeight: 18 },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#2A3E2A' },
  saveBtn: { backgroundColor: '#00B87C', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
