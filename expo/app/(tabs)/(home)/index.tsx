import React, { useState, useCallback, useRef, useEffect } from 'react';
import { NATIVE_DRIVER, enterAnimation } from '@/constants/animation';
import { radius, type, webInputReset , canvas } from '@/constants/theme';
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
  Modal,
  TextInput,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FolderOpen, Building2, ChevronRight, Home, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import FolderCard from '@/components/FolderCard';
import EmptyState from '@/components/EmptyState';
import SectionHeader from '@/components/SectionHeader';
import { NavigationView, Manufacturer, Order } from '@/types';
import { formatCurrency } from '@/utils/calculations';
import * as Haptics from 'expo-haptics';
import OrdersDashboard, { OrderCardItem, OrderTable } from '@/components/home/OrdersDashboard';
import { CompactTitleBar, PageHeader, PAGE_MAX, useCollapsingTitle, usePageLayout } from '@/components/Page';
import Button from '@/components/Button';
import { NAV_FULL_MIN, NAV_SIDE_MIN, NAV_WIDTH_COMPACT, NAV_WIDTH_FULL } from '@/components/AppNav';

// Vista elegida (se conserva al volver de un pedido)
let savedMode: 'lista' | 'carpetas' = 'lista';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width, pad, content, mobile, bottomSpace } = usePageLayout();
  const { shown: compactShown, scrollProps } = useCollapsingTitle();
  // Ancho útil real: ventana menos la barra lateral, con el máximo común y sin márgenes
  const navWidth = width >= NAV_FULL_MIN ? NAV_WIDTH_FULL : width >= NAV_SIDE_MIN ? NAV_WIDTH_COMPACT : 0;
  const innerWidth = Math.min(width - navWidth, PAGE_MAX) - pad * 2;
  const gridColumns = innerWidth >= 1000 ? 4 : innerWidth >= 640 ? 3 : innerWidth >= 320 ? 2 : 1;
  const useTable = width >= 1100; // igual que la lista del inicio
  const twoCols = width >= 700 && !useTable;

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
    duplicateOrders,
  } = useData();

  const [mode, setModeState] = useState<'lista' | 'carpetas'>(savedMode);
  const setMode = (m: 'lista' | 'carpetas') => {
    savedMode = m;
    setModeState(m);
  };
  const [currentView, setCurrentView] = useState<NavigationView>('years');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()));

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const modalScale = useRef(new Animated.Value(0.7)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalSlide = useRef(new Animated.Value(40)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;

  // Entrada suave y corta (estilo Apple): aparece y sube 12 px
  useEffect(() => {
    titleScale.setValue(1);
    enterAnimation(fadeAnim, slideAnim).start();
  }, [fadeAnim, slideAnim, titleScale]);

  const animateViewChange = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(12);
    enterAnimation(fadeAnim, slideAnim).start();
  }, [fadeAnim, slideAnim]);

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

  const gridGap = 12;
  const totalGapWidth = gridGap * (gridColumns - 1);
  const gridItemWidth = Math.max(140, Math.floor((innerWidth - totalGapWidth) / gridColumns));

  const renderBreadcrumbs = () => {
    if (currentView === 'years') return null;

    return (
      <View style={styles.breadcrumbs} accessibilityLabel="Ruta">
        <Pressable onPress={() => { setCurrentView('years'); setSelectedYear(null); setSelectedManufacturer(null); animateViewChange(); }} style={styles.breadcrumbItem} accessibilityRole="link" testID="crumb-years">
          <Home size={14} color={colors.primary} />
          <Text style={[styles.breadcrumbText, { color: colors.primary }]}>Años</Text>
        </Pressable>

        {selectedYear !== null && (
          <>
            <ChevronRight size={12} color={colors.textTertiary} />
            <Pressable
              onPress={() => { setCurrentView('manufacturers'); setSelectedManufacturer(null); animateViewChange(); }}
              style={styles.breadcrumbItem}
              accessibilityRole="link"
              testID="crumb-year"
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
            title="Años"
            subtitle="Elige un año para ver sus fabricantes y pedidos"
            actionLabel="Añadir año"
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
                  icon={<FolderOpen size={20} color={colors.primary} strokeWidth={2} />}
                  title={String(year)}
                  badges={[
                    { label: `${yearOrders.length} pedido${yearOrders.length !== 1 ? 's' : ''}`, color: colors.accent },
                    { label: `${manufacturersForYear.length} fabricante${manufacturersForYear.length !== 1 ? 's' : ''}`, color: colors.primary },
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
          title={String(selectedYear)}
          subtitle="Elige un fabricante para ver sus pedidos"
        />
        <View style={styles.grid}>
          {manufacturersForYear.map((manufacturer, index) => {
            const mfOrders = yearOrders.filter(o => o.manufacturer_id === manufacturer.id);
            const totalAmount = mfOrders.reduce((sum, o) => sum + o.total_with_vat, 0);

            return (
              <AnimatedGridItem key={manufacturer.id} index={index} width={gridItemWidth}>
                <FolderCard
                  icon={<Building2 size={20} color={colors.primary} strokeWidth={2} />}
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
          title={selectedManufacturer.name}
          subtitle={`${filteredOrders.length} ${filteredOrders.length === 1 ? 'pedido' : 'pedidos'} en ${selectedYear}`}
          actionLabel="Nuevo"
          onAction={() => router.push(`/order-form?manufacturerId=${selectedManufacturer.id}&year=${selectedYear}` as any)}
        />
        {useTable ? (
          <OrderTable orders={filteredOrders} onOpen={navigateToOrder} />
        ) : (
          <View style={twoCols ? [styles.grid, { justifyContent: 'space-between' }] : styles.list}>
            {filteredOrders.map(order => (
              <OrderCardItem key={order.id} order={order} onOpen={navigateToOrder} twoCols={twoCols} />
            ))}
          </View>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: canvas(colors) }]}>
      <CompactTitleBar title="Pedidos" shown={compactShown} />
      <ScrollView
        {...scrollProps}
        style={styles.scrollView}
        contentContainerStyle={[content, styles.scrollContent, { paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <PageHeader
          title="Pedidos"
          actions={
            mobile && !(mode === 'carpetas' && currentView === 'orders') ? (
              <Button
                label="Nuevo"
                icon={Plus}
                variant="primary"
                onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/order-form' as any); }}
                accessibilityLabel="Nuevo pedido"
                testID="header-new-order"
              />
            ) : undefined
          }
        />
        <View style={styles.modeRow}>
          <View style={[styles.segment, { backgroundColor: colors.fill }]} accessibilityRole="tablist">
            {(['lista', 'carpetas'] as const).map(m => (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  if (m === 'lista') { setCurrentView('years'); setSelectedYear(null); setSelectedManufacturer(null); }
                }}
                style={[styles.segBtn, mode === m && [styles.segOn, { backgroundColor: colors.surface }]]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                testID={`home-mode-${m}`}
              >
                <Text style={[styles.segText, { color: mode === m ? colors.text : colors.textSecondary }]}>{m === 'lista' ? 'Resumen y lista' : 'Por año y fabricante'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {mode === 'carpetas' && renderBreadcrumbs()}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {currentView === 'years' && mode === 'lista' && <OrdersDashboard />}
          {currentView === 'years' && mode === 'carpetas' && renderYearsView()}
          {mode === 'carpetas' && currentView === 'manufacturers' && renderManufacturersView()}
          {mode === 'carpetas' && currentView === 'orders' && renderOrdersView()}
        </Animated.View>
      </ScrollView>

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
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    enterAnimation(opacity, translateY, index).start();
  }, [opacity, translateY, index]);

  return (
    <Animated.View style={[styles.gridItem, { width, opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

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
    ...type.callout,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
  breadcrumbText: {
    ...type.footnote,
  },
  breadcrumbActiveFW: {
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  segBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segOn: {
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } as any) : { elevation: 1 }),
  },
  segText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {},
  list: {
    gap: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as any) : {}),
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xl,
    padding: 22,
  },
  modalTitle: {
    ...type.title3,
    marginBottom: 6,
  },
  modalSubtitle: {
    ...type.subhead,
    marginBottom: 16,
  },
  modalInput: {
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    letterSpacing: 1,
    borderWidth: 1,
    marginBottom: 18,
    ...webInputReset,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
