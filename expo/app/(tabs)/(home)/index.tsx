import React, { useState, useCallback, useRef, useEffect } from 'react';
import { NATIVE_DRIVER } from '@/constants/animation';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  useWindowDimensions,
  Modal,
  TextInput,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FolderOpen, Building2, FileText, ChevronRight, Home, Plus, ChevronLeft, Copy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import FolderCard from '@/components/FolderCard';
import EmptyState from '@/components/EmptyState';
import SectionHeader from '@/components/SectionHeader';
import StatusBadge from '@/components/StatusBadge';
import { NavigationView, Manufacturer, Order } from '@/types';
import { formatCurrency, formatDate } from '@/utils/calculations';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : width;
  const gridColumns = isDesktop ? 4 : isTablet ? 3 : 2;

  const {
    orders,
    years,
    isLoading,
    loadError,
    refresh,
    getOrdersByYear,
    getManufacturersForYear,
    getOrdersByManufacturerAndYear,
    addYear,
    duplicateOrder,
    duplicateOrders,
  } = useData();

  const [currentView, setCurrentView] = useState<NavigationView>('years');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()));

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fabScale = useRef(new Animated.Value(0)).current;
  const fabRotate = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.7)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalSlide = useRef(new Animated.Value(40)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.parallel([
        Animated.spring(fadeAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: NATIVE_DRIVER }),
        Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 50, useNativeDriver: NATIVE_DRIVER }),
      ]),
      Animated.spring(titleScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: NATIVE_DRIVER }),
      Animated.parallel([
        Animated.spring(fabScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: NATIVE_DRIVER }),
        Animated.spring(fabRotate, { toValue: 1, friction: 5, tension: 60, useNativeDriver: NATIVE_DRIVER }),
      ]),
    ]).start();
  }, [fabRotate, fabScale, fadeAnim, slideAnim, titleScale]);

  const animateViewChange = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    titleScale.setValue(0.85);
    Animated.parallel([
      Animated.spring(fadeAnim, { toValue: 1, friction: 6, tension: 50, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 50, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(titleScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [fadeAnim, slideAnim, titleScale]);

  useEffect(() => {
    if (yearModalOpen) {
      modalScale.setValue(0.7);
      modalOpacity.setValue(0);
      modalSlide.setValue(40);
      Animated.parallel([
        Animated.spring(modalScale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(modalOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }),
        Animated.spring(modalSlide, { toValue: 0, friction: 6, tension: 60, useNativeDriver: NATIVE_DRIVER }),
      ]).start();
    }
  }, [modalOpacity, modalScale, modalSlide, yearModalOpen]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const navigateToYear = useCallback((year: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedYear(year);
    setSelectedManufacturer(null);
    setCurrentView('manufacturers');
    animateViewChange();
  }, [animateViewChange]);

  const navigateToManufacturer = useCallback((manufacturer: Manufacturer) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedManufacturer(manufacturer);
    setCurrentView('orders');
    animateViewChange();
  }, [animateViewChange]);

  const navigateToOrder = useCallback((order: Order) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/order-detail?orderId=${order.id}` as any);
  }, [router]);

  const navigateBack = useCallback(() => {
    if (currentView === 'orders') {
      setSelectedManufacturer(null);
      setCurrentView('manufacturers');
    } else if (currentView === 'manufacturers') {
      setSelectedYear(null);
      setCurrentView('years');
    }
    animateViewChange();
  }, [currentView, animateViewChange]);

  const handleAddYear = useCallback(() => {
    setYearInput(String(new Date().getFullYear()));
    setYearModalOpen(true);
  }, []);

  const handleDuplicateYear = useCallback((year: number) => {
    const nextYear = year + 1;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `Duplicar año ${year}`,
      `¿Quieres crear el año ${nextYear} con una copia de los pedidos de ${year}?`,
      [
        { text: 'Solo año', onPress: async () => {
          try {
            const added = await addYear(nextYear);
            if (!added) Alert.alert('Info', `El año ${nextYear} ya existe`);
            else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {
            Alert.alert('Error', (e as Error).message);
          }
        }},
        { text: 'Año + pedidos', style: 'default', onPress: async () => {
          const yearOrders = getOrdersByYear(year);
          try {
            await addYear(nextYear);
            const count = await duplicateOrders(yearOrders.map(o => o.id), nextYear);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Duplicado', `Se duplicaron ${count} pedidos al año ${nextYear} (como pendientes).`);
          } catch (e) {
            Alert.alert('Duplicado incompleto', `${(e as Error).message}\nRevisa el año ${nextYear}: algunos pedidos pueden haberse copiado.`);
          }
        }},
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  }, [addYear, getOrdersByYear, duplicateOrders]);

  const handleDuplicateOrder = useCallback((order: Order) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Duplicar pedido',
      `¿Duplicar "${order.reference_number}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Duplicar', onPress: async () => {
          try {
            const created = await duplicateOrder(order.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Pedido duplicado', `Se creó "${created.reference_number}" como pedido pendiente.`);
          } catch (e) {
            Alert.alert('No se pudo duplicar', (e as Error).message);
          }
        }},
      ]
    );
  }, [duplicateOrder]);

  const confirmAddYear = useCallback(async () => {
    const year = parseInt(yearInput);
    if (isNaN(year) || year < 2000 || year > 2100) {
      Alert.alert('Error', 'Introduce un año válido (2000-2100)');
      return;
    }
    try {
      const added = await addYear(year);
      if (!added) {
        Alert.alert('Info', 'Este año ya existe');
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setYearModalOpen(false);
    } catch (e) {
      Alert.alert('No se pudo añadir el año', (e as Error).message);
    }
  }, [yearInput, addYear]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando...</Text>
      </View>
    );
  }

  if (loadError && orders.length === 0 && years.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[styles.loadingText, { color: colors.text, fontWeight: '700', fontSize: 16 }]}>No se pudieron cargar los datos</Text>
        <Text style={[styles.loadingText, { color: colors.textSecondary, textAlign: 'center' }]}>{loadError}</Text>
        <Pressable onPress={() => void refresh()} style={{ marginTop: 8, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }} testID="retry-load">
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const allYearSet = new Set([
    ...years,
    ...orders.map(o => o.year),
  ]);
  const allYears = Array.from(allYearSet).sort((a, b) => b - a);

  const horizontalPadding = 40;
  const gridGap = 12;
  const totalGapWidth = gridGap * (gridColumns - 1);
  const gridItemWidth = Math.max(
    155,
    Math.floor((contentMaxWidth - horizontalPadding - totalGapWidth) / gridColumns)
  );

  const fabSpin = fabRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderBreadcrumbs = () => {
    if (currentView === 'years') return null;

    return (
      <View style={[styles.breadcrumbs, { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as any }]}>
        <Pressable onPress={() => { setCurrentView('years'); setSelectedYear(null); setSelectedManufacturer(null); animateViewChange(); }} style={styles.breadcrumbItem}>
          <Home size={13} color={colors.primary} />
          <Text style={[styles.breadcrumbText, { color: colors.primary }]}>Inicio</Text>
        </Pressable>

        {selectedYear !== null && (
          <>
            <ChevronRight size={12} color={colors.textTertiary} />
            <Pressable
              onPress={() => { setCurrentView('manufacturers'); setSelectedManufacturer(null); animateViewChange(); }}
              style={styles.breadcrumbItem}
            >
              <Text style={[styles.breadcrumbText, { color: currentView === 'manufacturers' ? colors.text : colors.primary }, currentView === 'manufacturers' && styles.breadcrumbActiveFW]}>
                {selectedYear}
              </Text>
            </Pressable>
          </>
        )}

        {selectedManufacturer && (
          <>
            <ChevronRight size={12} color={colors.textTertiary} />
            <Text style={[styles.breadcrumbText, styles.breadcrumbActiveFW, { color: colors.text }]} numberOfLines={1}>
              {selectedManufacturer.name}
            </Text>
          </>
        )}
      </View>
    );
  };

  const renderYearsView = () => {
    if (allYears.length === 0) {
      return (
        <EmptyState
          title="No hay años creados"
          description="Crea tu primer año para comenzar a gestionar pedidos"
          actionLabel="Añadir Año"
          onAction={handleAddYear}
        />
      );
    }

    return (
      <>
        <Animated.View style={{ transform: [{ scale: titleScale }] }}>
          <SectionHeader
            title="Pedidos por Año"
            subtitle="Selecciona un año para ver los fabricantes"
            actionLabel="Añadir"
            onAction={handleAddYear}
          />
        </Animated.View>
        <View style={styles.grid}>
          {allYears.map((year, index) => {
            const yearOrders = getOrdersByYear(year);
            const manufacturersForYear = getManufacturersForYear(year);
            const totalAmount = yearOrders.reduce((sum, o) => sum + o.total_with_vat, 0);

            return (
              <AnimatedGridItem key={year} index={index} width={gridItemWidth}>
                <FolderCard
                  icon={<FolderOpen size={22} color={colors.primary} />}
                  title={String(year)}
                  badges={[
                    { label: `${yearOrders.length} pedido${yearOrders.length !== 1 ? 's' : ''}`, color: colors.accent },
                    { label: `${manufacturersForYear.length} fab.`, color: colors.primary },
                  ]}
                  totalLabel="Total"
                  totalValue={formatCurrency(totalAmount)}
                  onPress={() => navigateToYear(year)}
                  onDuplicate={() => handleDuplicateYear(year)}
                  testID={`year-folder-${year}`}
                />
              </AnimatedGridItem>
            );
          })}
        </View>
      </>
    );
  };

  const renderManufacturersView = () => {
    if (selectedYear === null) return null;
    const manufacturersForYear = getManufacturersForYear(selectedYear);
    const yearOrders = getOrdersByYear(selectedYear);

    if (manufacturersForYear.length === 0) {
      return (
        <EmptyState
          title={`No hay fabricantes en ${selectedYear}`}
          description="Añade un fabricante a este año desde la Gestión de Fabricantes"
        />
      );
    }

    return (
      <>
        <SectionHeader
          title={`Fabricantes en ${selectedYear}`}
          subtitle="Selecciona un fabricante para ver sus pedidos"
        />
        <View style={styles.grid}>
          {manufacturersForYear.map((manufacturer, index) => {
            const mfOrders = yearOrders.filter(o => o.manufacturer_id === manufacturer.id);
            const totalAmount = mfOrders.reduce((sum, o) => sum + o.total_with_vat, 0);

            return (
              <AnimatedGridItem key={manufacturer.id} index={index} width={gridItemWidth}>
                <FolderCard
                  icon={<Building2 size={22} color={colors.primary} />}
                  title={manufacturer.name}
                  subtitle={manufacturer.code}
                  badges={[
                    { label: `${mfOrders.length} pedido${mfOrders.length !== 1 ? 's' : ''}`, color: colors.accent },
                  ]}
                  totalLabel="Total"
                  totalValue={formatCurrency(totalAmount)}
                  onPress={() => navigateToManufacturer(manufacturer)}
                  testID={`manufacturer-folder-${manufacturer.code}`}
                />
              </AnimatedGridItem>
            );
          })}
        </View>
      </>
    );
  };

  const renderOrdersView = () => {
    if (selectedYear === null || selectedManufacturer === null) return null;
    const filteredOrders = getOrdersByManufacturerAndYear(selectedManufacturer.id, selectedYear);

    if (filteredOrders.length === 0) {
      return (
        <EmptyState
          title="No hay pedidos"
          description="No se encontraron pedidos para este fabricante"
          actionLabel="Nuevo Pedido"
          onAction={() => router.push(`/order-form?manufacturerId=${selectedManufacturer.id}&year=${selectedYear}` as any)}
        />
      );
    }

    return (
      <>
        <SectionHeader
          title="Pedidos"
          subtitle="Toca un pedido para ver los detalles"
          actionLabel="Nuevo"
          onAction={() => router.push(`/order-form?manufacturerId=${selectedManufacturer.id}&year=${selectedYear}` as any)}
        />
        <View style={styles.grid}>
          {filteredOrders.map((order, index) => (
            <AnimatedGridItem key={order.id} index={index} width={gridItemWidth}>
              <OrderCard
                order={order}
                onPress={() => navigateToOrder(order)}
                onDuplicate={() => handleDuplicateOrder(order)}
                colors={colors}
                isDark={isDark}
              />
            </AnimatedGridItem>
          ))}
        </View>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {currentView !== 'years' && (
        <View style={{ maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as any }}>
          <Pressable style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]} onPress={navigateBack}>
            <ChevronLeft size={20} color={colors.primary} />
            <Text style={[styles.backButtonText, { color: colors.primary }]}>Atrás</Text>
          </Pressable>
        </View>
      )}
      {renderBreadcrumbs()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as any }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {currentView === 'years' && renderYearsView()}
          {currentView === 'manufacturers' && renderManufacturersView()}
          {currentView === 'orders' && renderOrdersView()}
        </Animated.View>
      </ScrollView>

      {currentView === 'years' && (
        <Animated.View style={{ transform: [{ scale: fabScale }, { rotate: fabSpin }] }}>
          <Pressable
            style={({ pressed }) => [styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent, transform: [{ scale: pressed ? 0.85 : 1 }] }, isDesktop && styles.fabDesktop]}
            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/order-form' as any); }}
            testID="new-order-fab"
          >
            {isDesktop ? (
              <>
                <Plus size={18} color="#FFFFFF" />
                <Text style={styles.fabText}>Nuevo Pedido</Text>
              </>
            ) : (
              <Plus size={24} color="#FFFFFF" />
            )}
          </Pressable>
        </Animated.View>
      )}

      <Modal visible={yearModalOpen} transparent animationType="none" onRequestClose={() => setYearModalOpen(false)}>
        <Animated.View style={[styles.modalOverlay, { backgroundColor: colors.overlay, opacity: modalOpacity }]}>
          <Animated.View style={[styles.modalContent, { backgroundColor: colors.surface, transform: [{ scale: modalScale }, { translateY: modalSlide }] }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Añadir Año</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Introduce el año que quieres crear:</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={yearInput}
              onChangeText={setYearInput}
              keyboardType="numeric"
              placeholder="Ej: 2026"
              placeholderTextColor={colors.textTertiary}
              maxLength={4}
              selectTextOnFocus
              autoFocus
              testID="year-input"
            />
            <View style={[styles.modalActions, { borderTopColor: colors.divider }]}>
              <Pressable style={({ pressed }) => [styles.modalCancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]} onPress={() => setYearModalOpen(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.modalConfirmBtn, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.9 : 1 }] }]} onPress={confirmAddYear}>
                <Text style={styles.modalConfirmText}>Añadir</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

function AnimatedGridItem({ children, index, width }: { children: React.ReactNode; index: number; width: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(60)).current;
  const scaleVal = useRef(new Animated.Value(0.8)).current;
  const rotateVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(index * 100, 500);
    Animated.parallel([
      Animated.spring(anim, { toValue: 1, friction: 5, tension: 40, delay, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(slideY, { toValue: 0, friction: 5, tension: 40, delay, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(scaleVal, { toValue: 1, friction: 4, tension: 50, delay, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(rotateVal, { toValue: 1, duration: 500, delay, easing: Easing.out(Easing.back(1.5)), useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [anim, index, rotateVal, scaleVal, slideY]);

  const rotate = rotateVal.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-3deg', '1deg', '0deg'],
  });

  return (
    <Animated.View style={[styles.gridItem, { width, opacity: anim, transform: [{ translateY: slideY }, { scale: scaleVal }, { rotate }] }]}>
      {children}
    </Animated.View>
  );
}

const OrderCard = React.memo(function OrderCard({ order, onPress, onDuplicate, colors, isDark }: { order: Order; onPress: () => void; onDuplicate: () => void; colors: any; isDark: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
      ])
    ).start();
  }, [glowAnim]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, isDark ? 0.14 : 0.1],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.92, friction: 5, useNativeDriver: NATIVE_DRIVER }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: NATIVE_DRIVER }).start()}
        onLongPress={onDuplicate}
        delayLongPress={600}
        style={[styles.orderCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}
        testID={`order-card-${order.id}`}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, opacity: glowOpacity, borderRadius: 18 }]} />
        <View style={styles.orderCardHeader}>
          <View style={[styles.orderIconWrap, { backgroundColor: colors.primarySoft }]}>
            <FileText size={17} color={colors.primary} />
          </View>
          <View style={styles.orderCardHeaderRight}>
            <Pressable
              onPress={onDuplicate}
              hitSlop={8}
              style={({ pressed }) => [styles.duplicateBtn, { backgroundColor: colors.primarySoft, transform: [{ scale: pressed ? 0.85 : 1 }] }]}
            >
              <Copy size={12} color={colors.primary} />
            </Pressable>
            <StatusBadge status={order.status} size="sm" />
          </View>
        </View>

        <Text style={[styles.orderRefLabel, { color: colors.textTertiary }]}>Referencia</Text>
        <Text style={[styles.orderRef, { color: colors.text }]} numberOfLines={1}>{order.reference_number}</Text>

        {order.custom_reference ? (
          <View style={[styles.orderCustomRefRow, { backgroundColor: colors.primarySoft, borderLeftColor: colors.accent }]}>
            <Text style={[styles.orderCustomRefLabel, { color: colors.textTertiary }]}>Ref. Manual</Text>
            <Text style={[styles.orderCustomRefValue, { color: colors.primary }]} numberOfLines={1}>{order.custom_reference}</Text>
          </View>
        ) : null}

        <Text style={[styles.orderCustomer, { color: colors.textSecondary }]} numberOfLines={1}>
          {order.customer.nombre_empresa}
        </Text>

        <View style={[styles.orderTotalRow, { borderTopColor: colors.divider }]}>
          <Text style={[styles.orderTotalLabel, { color: colors.textTertiary }]}>Total</Text>
          <Text style={[styles.orderTotalValue, { color: colors.text }]}>{formatCurrency(order.total_with_vat)}</Text>
        </View>

        <View style={[styles.orderFooter, { borderTopColor: colors.divider }]}>
          <Text style={[styles.orderDate, { color: colors.textTertiary }]}>{formatDate(order.created_at)}</Text>
          <View style={[styles.orderProductsBadge, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.orderProductsText, { color: colors.textSecondary }]}>{order.items.length} prod.</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    flexWrap: 'wrap',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  breadcrumbActiveFW: {
    fontWeight: '700' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 12,
  },
  gridItem: {
    flexGrow: 0,
    minWidth: 155,
  },
  orderCard: {
    borderRadius: 18,
    padding: 16,
    minHeight: 188,
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  duplicateBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderRefLabel: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  orderRef: {
    fontSize: 13,
    fontWeight: '800' as const,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  orderCustomRefRow: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  orderCustomRefLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  orderCustomRefValue: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  orderCustomer: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 10,
  },
  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  orderTotalLabel: {
    fontSize: 11,
  },
  orderTotalValue: {
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  orderDate: {
    fontSize: 11,
  },
  orderProductsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderProductsText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabDesktop: {
    width: 'auto' as any,
    height: 50,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 26,
    borderRadius: 14,
    right: 32,
    bottom: 32,
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 24,
    padding: 28,
    width: '100%' as any,
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '800' as const,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
  },
  modalCancelBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  modalConfirmBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
