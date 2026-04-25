import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// ── Types ────────────────────────────────────────────────────────────────────

interface PriceAlert {
  id: string;
  product_name: string;
  postal_code: string;
  target_price: number;
  notify_email?: string;
  active: boolean;
  created_at: string;
  last_seen_price?: number;
  last_checked_at?: string;
  last_triggered_at?: string;
  best_merchant?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Index() {
  const [postalCode, setPostalCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [shoppingCart, setShoppingCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [comparison, setComparison] = useState(null);
  const [savingsHistory, setSavingsHistory] = useState([]);
  const [totalSavings, setTotalSavings] = useState(0);

  // ── Alert state ────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [newAlertProduct, setNewAlertProduct] = useState('');
  const [newAlertPrice, setNewAlertPrice] = useState('');
  const [newAlertEmail, setNewAlertEmail] = useState('');
  const [alertPostalCode, setAlertPostalCode] = useState('');
  const [checkingAlerts, setCheckingAlerts] = useState(false);

  useEffect(() => {
    loadSavedData();
    loadSavingsHistory();
  }, []);

  useEffect(() => {
    if (currentView === 'alerts') loadAlerts();
  }, [currentView]);

  // ── Persistence ────────────────────────────────────────────────────────────

  const loadSavedData = async () => {
    try {
      const savedPostalCode = await AsyncStorage.getItem('postalCode');
      const savedCart = await AsyncStorage.getItem('shoppingCart');
      const savedEmail = await AsyncStorage.getItem('alertEmail');
      if (savedPostalCode) { setPostalCode(savedPostalCode); setAlertPostalCode(savedPostalCode); }
      if (savedCart) setShoppingCart(JSON.parse(savedCart));
      if (savedEmail) setNewAlertEmail(savedEmail);
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  };

  const saveData = async (key: string, value: any) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // ── Location ───────────────────────────────────────────────────────────────

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed to find stores near you.');
        return false;
      }
      return true;
    } catch (error) { return false; }
  };

  const getLocationPostalCode = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;
    setLoading(true);
    try {
      const location = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (geocode[0]?.postalCode) {
        const pc = geocode[0].postalCode.replace(/\s/g, '');
        setPostalCode(pc);
        setAlertPostalCode(pc);
        await AsyncStorage.setItem('postalCode', pc);
        Alert.alert('Success', `Location set to: ${pc}`);
      } else {
        Alert.alert('Error', 'Could not determine postal code from your location.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get your location. Please enter postal code manually.');
    } finally {
      setLoading(false);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────

  const searchItems = async () => {
    if (!searchQuery.trim() || !postalCode.trim()) {
      Alert.alert('Missing Information', 'Please enter both search term and postal code.');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/search`, {
        query: searchQuery, postal_code: postalCode,
      });
      if (response.data.success) {
        setSearchResults(response.data.items);
        setCurrentView('search');
      } else {
        Alert.alert('Error', 'Failed to search items.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search for items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Cart ───────────────────────────────────────────────────────────────────

  const addToCart = (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const existingItem = shoppingCart.find((i) => i.global_id === item.global_id);
    let newCart;
    if (existingItem) {
      newCart = shoppingCart.map((i) =>
        i.global_id === item.global_id ? { ...i, quantity: i.quantity + 1 } : i
      );
    } else {
      newCart = [...shoppingCart, { ...item, quantity: 1, id: Date.now().toString() }];
    }
    setShoppingCart(newCart);
    saveData('shoppingCart', newCart);
  };

  const updateItemQuantityInSearch = (item: any, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const existingItem = shoppingCart.find((i) => i.global_id === item.global_id);
    if (!existingItem && delta > 0) { addToCart(item); return; }
    if (existingItem) {
      const newQuantity = existingItem.quantity + delta;
      if (newQuantity <= 0) {
        const newCart = shoppingCart.filter((i) => i.global_id !== item.global_id);
        setShoppingCart(newCart); saveData('shoppingCart', newCart);
      } else {
        const newCart = shoppingCart.map((i) =>
          i.global_id === item.global_id ? { ...i, quantity: newQuantity } : i
        );
        setShoppingCart(newCart); saveData('shoppingCart', newCart);
      }
    }
  };

  const getItemQuantityInCart = (globalId: string) => {
    const item = shoppingCart.find((i) => i.global_id === globalId);
    return item ? item.quantity : 0;
  };

  const removeFromCart = (itemId: string) => {
    const newCart = shoppingCart.filter((i) => i.id !== itemId);
    setShoppingCart(newCart); saveData('shoppingCart', newCart);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newCart = shoppingCart.map((item) => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    });
    setShoppingCart(newCart); saveData('shoppingCart', newCart);
  };

  // ── Compare & Shopping ─────────────────────────────────────────────────────

  const compareStores = async () => {
    if (shoppingCart.length === 0) { Alert.alert('Empty Cart', 'Please add items to your cart first.'); return; }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/compare-stores`, {
        id: Date.now().toString(), items: shoppingCart,
        created_at: new Date().toISOString(), completed: false,
      });
      if (response.data.success) { setComparison(response.data); setCurrentView('cart'); }
    } catch (error) {
      Alert.alert('Error', 'Failed to compare stores.');
    } finally {
      setLoading(false);
    }
  };

  const startShopping = () => {
    if (!comparison) { compareStores(); }
    setCurrentView('shopping');
  };

  const completeShopping = async () => {
    if (!comparison) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/savings`, {
        id: Date.now().toString(),
        shopping_list_id: Date.now().toString(),
        best_store: comparison.best_store,
        total_cost: comparison.best_store_total,
        potential_costs: comparison.store_totals,
        savings: comparison.savings,
        completed_at: new Date().toISOString(),
      });
      Alert.alert('Complete!', `You saved $${comparison.savings.toFixed(2)} by shopping at ${comparison.best_store}!`);
      setShoppingCart([]); setComparison(null);
      await AsyncStorage.setItem('shoppingCart', JSON.stringify([]));
      loadSavingsHistory();
      setCurrentView('home');
    } catch (error) {
      Alert.alert('Error', 'Failed to save your shopping trip.');
    } finally {
      setLoading(false);
    }
  };

  const loadSavingsHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/savings`);
      if (response.data.success) {
        setSavingsHistory(response.data.records);
        setTotalSavings(response.data.total_savings);
      }
    } catch (error) { console.error('Error loading savings history:', error); }
  };

  // ── Alert helpers ──────────────────────────────────────────────────────────

  const loadAlerts = async () => {
    setAlertsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/alerts`);
      if (response.data.success) setAlerts(response.data.alerts);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setAlertsLoading(false);
    }
  };

  const createAlert = async () => {
    if (!newAlertProduct.trim()) {
      Alert.alert('Missing Info', 'Please enter a product name.');
      return;
    }
    const targetPrice = parseFloat(newAlertPrice);
    if (isNaN(targetPrice) || targetPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid target price.');
      return;
    }
    const pc = alertPostalCode.trim() || postalCode.trim();
    if (!pc) {
      Alert.alert('Missing Info', 'Please enter a postal code.');
      return;
    }
    setAlertsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/alerts`, {
        product_name: newAlertProduct.trim(),
        postal_code: pc,
        target_price: targetPrice,
        notify_email: newAlertEmail.trim() || undefined,
      });
      if (response.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setNewAlertProduct('');
        setNewAlertPrice('');
        if (newAlertEmail) await AsyncStorage.setItem('alertEmail', newAlertEmail);
        await loadAlerts();
        Alert.alert('Alert Created! 🔔', `We'll notify you when ${newAlertProduct} drops to $${targetPrice.toFixed(2)} or below.`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create alert. Please try again.');
    } finally {
      setAlertsLoading(false);
    }
  };

  const toggleAlert = async (alert: PriceAlert) => {
    try {
      await axios.patch(`${API_URL}/api/alerts/${alert.id}`, {
        active: !alert.active,
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, active: !a.active } : a))
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert('Error', 'Failed to update alert.');
    }
  };

  const deleteAlert = async (alertId: string) => {
    Alert.alert('Delete Alert', 'Are you sure you want to remove this alert?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/api/alerts/${alertId}`);
            setAlerts((prev) => prev.filter((a) => a.id !== alertId));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete alert.');
          }
        },
      },
    ]);
  };

  const runAlertCheck = async () => {
    setCheckingAlerts(true);
    try {
      const response = await axios.post(`${API_URL}/api/alerts/check`);
      const { checked, fired } = response.data;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Check Complete ✅',
        fired > 0
          ? `${fired} deal${fired > 1 ? 's' : ''} found across ${checked} watched item${checked !== 1 ? 's' : ''}!`
          : `Checked ${checked} item${checked !== 1 ? 's' : ''} — no deals hit your targets yet.`
      );
      await loadAlerts();
    } catch (error) {
      Alert.alert('Error', 'Alert check failed. Please try again.');
    } finally {
      setCheckingAlerts(false);
    }
  };

  // ── Render: Home ───────────────────────────────────────────────────────────

  const renderHome = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="cart" size={48} color="#4CAF50" />
        <Text style={styles.title}>Smart Grocery Saver</Text>
        <Text style={styles.subtitle}>Find the best deals around you</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Location</Text>
        <View style={styles.locationContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter Postal Code (e.g., L4W3H8)"
            value={postalCode}
            onChangeText={setPostalCode}
            autoCapitalize="characters"
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.iconButton} onPress={getLocationPostalCode}>
            <Ionicons name="location" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Search for Items</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., milk, bread, eggs"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={searchItems}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Search</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="basket" size={32} color="#4CAF50" />
          <Text style={styles.statNumber}>{shoppingCart.length}</Text>
          <Text style={styles.statLabel}>Items in Cart</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="cash" size={32} color="#FF9800" />
          <Text style={styles.statNumber}>${totalSavings.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Saved</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="notifications" size={32} color="#2196F3" />
          <Text style={styles.statNumber}>{alerts.filter((a) => a.active).length}</Text>
          <Text style={styles.statLabel}>Active Alerts</Text>
        </View>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setCurrentView('cart')}>
          <Ionicons name="cart-outline" size={20} color="#4CAF50" />
          <Text style={styles.secondaryButtonText}>View Cart ({shoppingCart.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.alertButton]}
          onPress={() => { loadAlerts(); setCurrentView('alerts'); }}
        >
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Deal Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => { loadSavingsHistory(); setCurrentView('savings'); }}
        >
          <Ionicons name="bar-chart" size={20} color="#4CAF50" />
          <Text style={styles.secondaryButtonText}>Savings History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Render: Alerts ─────────────────────────────────────────────────────────

  const renderAlerts = () => (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setCurrentView('home')}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deal Alerts 🔔</Text>
        <TouchableOpacity onPress={runAlertCheck} disabled={checkingAlerts}>
          {checkingAlerts
            ? <ActivityIndicator size="small" color="#2196F3" />
            : <Ionicons name="refresh" size={26} color="#2196F3" />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Create Alert Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Watch a New Product</Text>

          <Text style={styles.inputLabel}>Product name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 2% Milk, Eggs 12pk"
            value={newAlertProduct}
            onChangeText={setNewAlertProduct}
            placeholderTextColor="#999"
          />

          <Text style={[styles.inputLabel, { marginTop: 10 }]}>Target price ($)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 3.99"
            value={newAlertPrice}
            onChangeText={setNewAlertPrice}
            keyboardType="decimal-pad"
            placeholderTextColor="#999"
          />

          <Text style={[styles.inputLabel, { marginTop: 10 }]}>Postal code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., L4W3H8"
            value={alertPostalCode}
            onChangeText={setAlertPostalCode}
            autoCapitalize="characters"
            placeholderTextColor="#999"
          />

          <Text style={[styles.inputLabel, { marginTop: 10 }]}>Email for notifications (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="you@email.com"
            value={newAlertEmail}
            onChangeText={setNewAlertEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />

          <TouchableOpacity
            style={[styles.button, styles.alertButton, { marginTop: 14 }]}
            onPress={createAlert}
            disabled={alertsLoading}
          >
            {alertsLoading
              ? <ActivityIndicator color="#fff" />
              : (<>
                  <Ionicons name="notifications-outline" size={20} color="#fff" />
                  <Text style={[styles.buttonText, { marginLeft: 8 }]}>Set Alert</Text>
                </>)
            }
          </TouchableOpacity>
        </View>

        {/* Alert list */}
        <Text style={styles.sectionLabel}>
          {alerts.length === 0 ? 'No alerts yet' : `${alerts.length} watched item${alerts.length !== 1 ? 's' : ''}`}
        </Text>

        {alertsLoading && alerts.length === 0 && (
          <ActivityIndicator color="#2196F3" style={{ marginTop: 24 }} />
        )}

        {alerts.map((alert) => (
          <View key={alert.id} style={[styles.alertCard, !alert.active && styles.alertCardInactive]}>
            <View style={styles.alertCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertProductName} numberOfLines={1}>{alert.product_name}</Text>
                <Text style={styles.alertPostalCode}>📍 {alert.postal_code}</Text>
              </View>
              <Switch
                value={alert.active}
                onValueChange={() => toggleAlert(alert)}
                trackColor={{ false: '#ccc', true: '#a5d6a7' }}
                thumbColor={alert.active ? '#4CAF50' : '#999'}
              />
            </View>

            <View style={styles.alertPriceRow}>
              <View style={styles.alertPriceBlock}>
                <Text style={styles.alertPriceLabel}>Target</Text>
                <Text style={styles.alertTargetPrice}>${alert.target_price.toFixed(2)}</Text>
              </View>
              {alert.last_seen_price != null && (
                <View style={styles.alertPriceBlock}>
                  <Text style={styles.alertPriceLabel}>Last seen</Text>
                  <Text style={[
                    styles.alertCurrentPrice,
                    alert.last_seen_price <= alert.target_price && styles.alertPriceDealActive,
                  ]}>
                    ${alert.last_seen_price.toFixed(2)}
                  </Text>
                </View>
              )}
              {alert.best_merchant && (
                <View style={[styles.alertPriceBlock, { flex: 1.2 }]}>
                  <Text style={styles.alertPriceLabel}>Best at</Text>
                  <Text style={styles.alertMerchant} numberOfLines={1}>{alert.best_merchant}</Text>
                </View>
              )}
            </View>

            {alert.last_triggered_at && (
              <View style={styles.alertTriggeredBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                <Text style={styles.alertTriggeredText}>
                  Deal found · {new Date(alert.last_triggered_at).toLocaleDateString()}
                </Text>
              </View>
            )}

            {alert.last_checked_at && (
              <Text style={styles.alertLastChecked}>
                Last checked: {new Date(alert.last_checked_at).toLocaleString()}
              </Text>
            )}

            <TouchableOpacity
              style={styles.alertDeleteButton}
              onPress={() => deleteAlert(alert.id)}
            >
              <Ionicons name="trash-outline" size={18} color="#f44336" />
              <Text style={styles.alertDeleteText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}

        {alerts.length > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, { marginBottom: 24 }]}
            onPress={runAlertCheck}
            disabled={checkingAlerts}
          >
            {checkingAlerts
              ? <ActivityIndicator color="#fff" />
              : (<>
                  <Ionicons name="pulse" size={20} color="#fff" />
                  <Text style={[styles.buttonText, { marginLeft: 8 }]}>Check All Prices Now</Text>
                </>)
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  // ── Render: Search results ─────────────────────────────────────────────────

  const renderSearchResults = () => {
    const cheapestPrice = searchResults.length > 0 ? searchResults[0].current_price : 0;
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCurrentView('home'); }}>
            <Ionicons name="arrow-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search Results</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView style={styles.scrollView}>
          {searchResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No items found</Text>
            </View>
          ) : (
            searchResults.map((item, index) => {
              const priceDifference = item.current_price - cheapestPrice;
              const isFirst = index === 0;
              const quantityInCart = getItemQuantityInCart(item.global_id);
              return (
                <View key={index} style={styles.itemCard}>
                  {isFirst && (
                    <View style={styles.bestPriceBadge}>
                      <Ionicons name="trophy" size={16} color="#FFD700" />
                      <Text style={styles.bestPriceText}>Best Price</Text>
                    </View>
                  )}
                  <View style={styles.itemRow}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.productImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.productImagePlaceholder}>
                        <Ionicons name="image-outline" size={40} color="#ccc" />
                      </View>
                    )}
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                      <View style={styles.storeRow}>
                        {item.merchant_logo
                          ? <Image source={{ uri: item.merchant_logo }} style={styles.storeLogo} resizeMode="contain" />
                          : <Ionicons name="storefront" size={16} color="#666" />}
                        <Text style={styles.itemStore}>{item.merchant}</Text>
                      </View>
                      <View style={styles.priceRow}>
                        <Text style={styles.itemPrice}>${item.current_price.toFixed(2)}</Text>
                        {!isFirst && priceDifference > 0 && (
                          <Text style={styles.priceDifference}>+${priceDifference.toFixed(2)} vs cheapest</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  {quantityInCart > 0 ? (
                    <View style={styles.quantityControlsInline}>
                      <TouchableOpacity style={styles.quantityButtonInline} onPress={() => updateItemQuantityInSearch(item, -1)}>
                        <Ionicons name="remove" size={20} color="#fff" />
                      </TouchableOpacity>
                      <View style={styles.quantityDisplayInline}>
                        <Text style={styles.quantityTextInline}>{quantityInCart}</Text>
                        <Text style={styles.quantityLabelInline}>in cart</Text>
                      </View>
                      <TouchableOpacity style={styles.quantityButtonInline} onPress={() => updateItemQuantityInSearch(item, 1)}>
                        <Ionicons name="add" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addButton} onPress={() => addToCart(item)}>
                      <Ionicons name="add" size={20} color="#fff" />
                      <Text style={styles.addButtonText}>Add to Cart</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  // ── Render: Cart ───────────────────────────────────────────────────────────

  const renderCart = () => {
    const cartTotal = shoppingCart.reduce((sum, item) => sum + item.current_price * item.quantity, 0);
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setCurrentView('home')}>
            <Ionicons name="arrow-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Shopping Cart</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView style={styles.scrollView}>
          {shoppingCart.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cart-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Your cart is empty</Text>
            </View>
          ) : (
            <>
              {shoppingCart.map((item) => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.itemStore}>{item.merchant}</Text>
                    <Text style={styles.itemPrice}>
                      ${item.current_price.toFixed(2)} × {item.quantity} = ${(item.current_price * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.cartItemActions}>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity style={styles.quantityButton} onPress={() => updateQuantity(item.id, -1)}>
                        <Ionicons name="remove" size={20} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.quantityButton} onPress={() => updateQuantity(item.id, 1)}>
                        <Ionicons name="add" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeFromCart(item.id)}>
                      <Ionicons name="trash" size={24} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Cart Total:</Text>
                <Text style={styles.totalAmount}>${cartTotal.toFixed(2)}</Text>
              </View>
              {comparison && (
                <View style={styles.comparisonCard}>
                  <Text style={styles.comparisonTitle}>Best Store Comparison</Text>
                  <View style={styles.bestStoreHighlight}>
                    <Ionicons name="trophy" size={32} color="#FFD700" />
                    <View style={styles.bestStoreInfo}>
                      <Text style={styles.bestStoreName}>{comparison.best_store}</Text>
                      <Text style={styles.bestStorePrice}>${comparison.best_store_total.toFixed(2)}</Text>
                    </View>
                  </View>
                  <Text style={styles.savingsText}>You could save ${comparison.savings.toFixed(2)} shopping here!</Text>
                  <View style={styles.storeList}>
                    {Object.entries(comparison.store_totals).map(([store, total]) => (
                      <View key={store} style={styles.storeItem}>
                        <Text style={styles.storeName}>{store}</Text>
                        <Text style={styles.storePrice}>${(total as number).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={compareStores} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Compare Stores</Text>}
              </TouchableOpacity>
              {comparison && (
                <TouchableOpacity style={[styles.button, styles.shoppingButton]} onPress={startShopping}>
                  <Ionicons name="bag-check" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Let's Go Shopping!</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  // ── Render: Shopping ───────────────────────────────────────────────────────

  const renderShopping = () => {
    const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>({});
    const toggleItem = (itemId: string) => setCheckedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
    const allChecked = shoppingCart.every((item) => checkedItems[item.id]);
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setCurrentView('cart')}>
            <Ionicons name="arrow-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Shopping List</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.shoppingHeader}>
          <Ionicons name="storefront" size={32} color="#4CAF50" />
          <Text style={styles.shoppingStore}>Shopping at: {comparison?.best_store}</Text>
        </View>
        <ScrollView style={styles.scrollView}>
          {shoppingCart.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.shoppingItem, checkedItems[item.id] && styles.shoppingItemChecked]}
              onPress={() => toggleItem(item.id)}
            >
              <View style={styles.checkbox}>
                {checkedItems[item.id] && <Ionicons name="checkmark" size={20} color="#4CAF50" />}
              </View>
              <View style={styles.shoppingItemInfo}>
                <Text style={[styles.shoppingItemName, checkedItems[item.id] && styles.shoppingItemNameChecked]}>
                  {item.name}
                </Text>
                <Text style={styles.shoppingItemDetails}>Qty: {item.quantity} | ${item.current_price.toFixed(2)} each</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {allChecked && (
          <TouchableOpacity style={[styles.button, styles.completeButton]} onPress={completeShopping} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (<>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.buttonText}>Complete Shopping</Text>
            </>)}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Render: Savings ────────────────────────────────────────────────────────

  const renderSavings = () => (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setCurrentView('home')}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Savings History</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.savingsHeader}>
        <Ionicons name="trending-up" size={48} color="#4CAF50" />
        <Text style={styles.totalSavingsText}>Total Savings</Text>
        <Text style={styles.totalSavingsAmount}>${totalSavings.toFixed(2)}</Text>
      </View>
      <ScrollView style={styles.scrollView}>
        {savingsHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No shopping trips yet</Text>
          </View>
        ) : (
          savingsHistory.map((record, index) => (
            <View key={index} style={styles.savingsCard}>
              <View style={styles.savingsCardHeader}>
                <Text style={styles.savingsDate}>{new Date(record.completed_at).toLocaleDateString()}</Text>
                <Text style={styles.savingsAmount}>+${record.savings.toFixed(2)}</Text>
              </View>
              <Text style={styles.savingsStore}>Shopped at: {record.best_store}</Text>
              <Text style={styles.savingsTotal}>Total: ${record.total_cost.toFixed(2)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  // ── Root render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        {currentView === 'home' && renderHome()}
        {currentView === 'search' && renderSearchResults()}
        {currentView === 'cart' && renderCart()}
        {currentView === 'shopping' && renderShopping()}
        {currentView === 'savings' && renderSavings()}
        {currentView === 'alerts' && renderAlerts()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  keyboardView: { flex: 1 },
  container: { flex: 1, padding: 16 },
  scrollView: { flex: 1 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginTop: 8 },
  subtitle: { fontSize: 16, color: '#666', marginTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
  locationContainer: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, fontSize: 16, color: '#333' },
  inputLabel: { fontSize: 13, fontWeight: '500', color: '#555', marginBottom: 6 },
  iconButton: { marginLeft: 8, padding: 8 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, padding: 16, marginTop: 12 },
  primaryButton: { backgroundColor: '#4CAF50' },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#4CAF50' },
  alertButton: { backgroundColor: '#2196F3' },
  shoppingButton: { backgroundColor: '#FF9800' },
  completeButton: { backgroundColor: '#4CAF50', marginVertical: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  secondaryButtonText: { color: '#4CAF50', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  statsContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 6 },
  statLabel: { fontSize: 11, color: '#666', marginTop: 3, textAlign: 'center' },
  actionButtons: { gap: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 18, color: '#999', marginTop: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 10, marginTop: 4 },
  // Alert card styles
  alertCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  alertCardInactive: { opacity: 0.55 },
  alertCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  alertProductName: { fontSize: 16, fontWeight: '700', color: '#222' },
  alertPostalCode: { fontSize: 12, color: '#888', marginTop: 2 },
  alertPriceRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  alertPriceBlock: { flex: 1 },
  alertPriceLabel: { fontSize: 11, color: '#999', marginBottom: 2 },
  alertTargetPrice: { fontSize: 18, fontWeight: 'bold', color: '#2196F3' },
  alertCurrentPrice: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  alertPriceDealActive: { color: '#4CAF50' },
  alertMerchant: { fontSize: 13, color: '#555', fontWeight: '500' },
  alertTriggeredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5E9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 6 },
  alertTriggeredText: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  alertLastChecked: { fontSize: 11, color: '#bbb', marginBottom: 8 },
  alertDeleteButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  alertDeleteText: { fontSize: 13, color: '#f44336' },
  // Search / item styles
  itemCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  bestPriceBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FFF8DC', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 1 },
  bestPriceText: { fontSize: 12, fontWeight: '600', color: '#DAA520' },
  itemRow: { flexDirection: 'row', marginBottom: 12 },
  productImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#f5f5f5' },
  productImagePlaceholder: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  itemDetails: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
  storeLogo: { width: 20, height: 20, borderRadius: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  priceDifference: { fontSize: 12, color: '#FF6B6B', backgroundColor: '#FFE5E5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  addButton: { backgroundColor: '#4CAF50', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  quantityControlsInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E8F5E9', borderRadius: 8, padding: 12, marginTop: 8 },
  quantityButtonInline: { backgroundColor: '#4CAF50', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  quantityDisplayInline: { alignItems: 'center', flex: 1 },
  quantityTextInline: { fontSize: 24, fontWeight: 'bold', color: '#4CAF50' },
  quantityLabelInline: { fontSize: 12, color: '#666', marginTop: 2 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  itemStore: { fontSize: 14, color: '#666' },
  itemPrice: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },
  cartItem: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  cartItemInfo: { marginBottom: 12 },
  cartItemActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quantityButton: { backgroundColor: '#4CAF50', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  quantityText: { fontSize: 18, fontWeight: '600', color: '#333', minWidth: 32, textAlign: 'center' },
  totalCard: { backgroundColor: '#4CAF50', borderRadius: 12, padding: 20, marginVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 20, fontWeight: '600', color: '#fff' },
  totalAmount: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  comparisonCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  comparisonTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16 },
  bestStoreHighlight: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8DC', borderRadius: 8, padding: 16, marginBottom: 12 },
  bestStoreInfo: { marginLeft: 16, flex: 1 },
  bestStoreName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  bestStorePrice: { fontSize: 24, fontWeight: 'bold', color: '#4CAF50', marginTop: 4 },
  savingsText: { fontSize: 16, fontWeight: '600', color: '#FF9800', textAlign: 'center', marginBottom: 16 },
  storeList: { gap: 8 },
  storeItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8 },
  storeName: { fontSize: 14, color: '#333' },
  storePrice: { fontSize: 14, fontWeight: '600', color: '#333' },
  shoppingHeader: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  shoppingStore: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 8 },
  shoppingItem: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  shoppingItemChecked: { backgroundColor: '#E8F5E9' },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#4CAF50', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  shoppingItemInfo: { flex: 1 },
  shoppingItemName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  shoppingItemNameChecked: { textDecorationLine: 'line-through', color: '#999' },
  shoppingItemDetails: { fontSize: 14, color: '#666' },
  savingsHeader: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  totalSavingsText: { fontSize: 18, color: '#666', marginTop: 12 },
  totalSavingsAmount: { fontSize: 36, fontWeight: 'bold', color: '#4CAF50', marginTop: 8 },
  savingsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  savingsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  savingsDate: { fontSize: 14, color: '#666' },
  savingsAmount: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },
  savingsStore: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  savingsTotal: { fontSize: 14, color: '#666' },
});
