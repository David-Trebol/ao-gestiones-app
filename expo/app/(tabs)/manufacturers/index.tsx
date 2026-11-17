import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { NATIVE_DRIVER } from '@/constants/animation';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Modal,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Building2, Plus, Check, MoreHorizontal, Package, Euro, Layers } from 'lucide-react-native';
import { PageHeader, PAGE_MAX, usePageLayout } from '@/components/Page';
import Button from '@/components/Button';
import SearchField from '@/components/SearchField';
import { NAV_FULL_MIN, NAV_SIDE_MIN, NAV_WIDTH_COMPACT, NAV_WIDTH_FULL } from '@/components/AppNav';
import { canvas, cardShadow, webInputReset } from '@/constants/theme';
import SelectSheet from '@/components/SelectSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { Manufacturer } from '@/types';
import { formatCurrency, formatDate } from '@/utils/calculations';
import * as Haptics from 'expo-haptics';

/** Quita acentos y mayúsculas para buscar */
const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ManufacturersScreen() {
  const { manufacturers, years, orders, addManufacturer, updateManufacturer, deleteManufacturer, duplicateManufacturer } = useData();
  const { colors, isDark } = useTheme();
  const { width, pad, content, bottomSpace } = usePageLayout();
  // Ordenador: rejilla de tarjetas (2-4 columnas de ~300 px); móvil: lista agrupada como en iOS
  const grid = width >= 1024;
  const navWidth = width >= NAV_FULL_MIN ? NAV_WIDTH_FULL : width >= NAV_SIDE_MIN ? NAV_WIDTH_COMPACT : 0;
  const innerWidth = Math.min(width - navWidth, PAGE_MAX) - pad * 2;
  const GAP = 16;
  const cols = Math.max(1, Math.min(4, Math.floor((innerWidth + GAP) / (300 + GAP))));
  const cardWidth = Math.floor((innerWidth - GAP * (cols - 1)) / cols);
  const [query, setQuery] = useState('');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [yearsDialogOpen, setYearsDialogOpen] = useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | null>(null);

  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const headerScale = useRef(new Animated.Value(0.96)).current;
  const modalScale = useRef(new Animated.Value(0.96)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalSlide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerFade, { toValue: 1, friction: 5, tension: 40, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(headerSlide, { toValue: 0, friction: 5, tension: 40, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(headerScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [headerFade, headerScale, headerSlide]);

  const animateModal = useCallback(() => {
    modalScale.setValue(0.7);
    modalOpacity.setValue(0);
    modalSlide.setValue(40);
    Animated.parallel([
      Animated.spring(modalScale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(modalOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(modalSlide, { toValue: 0, friction: 6, tension: 60, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [modalScale, modalOpacity, modalSlide]);

  const handleCreate = useCallback(async () => {
    if (!formName.trim() || !formCode.trim()) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    try {
      await addManufacturer(formName.trim(), formCode.trim());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreateDialogOpen(false);
      setFormName('');
      setFormCode('');
    } catch (e) {
      Alert.alert('No se pudo crear', (e as Error).message);
    }
  }, [formName, formCode, addManufacturer]);

  const handleEdit = useCallback(async () => {
    if (!selectedManufacturer || !formName.trim() || !formCode.trim()) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    try {
      await updateManufacturer(selectedManufacturer.id, { name: formName.trim(), code: formCode.trim() });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditDialogOpen(false);
      setSelectedManufacturer(null);
      setFormName('');
      setFormCode('');
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    }
  }, [selectedManufacturer, formName, formCode, updateManufacturer]);

  const handleDelete = useCallback((manufacturer: Manufacturer) => {
    Alert.alert(
      '¿Eliminar fabricante?',
      `Se eliminará "${manufacturer.name}". Solo se puede eliminar si no tiene pedidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await deleteManufacturer(manufacturer.id);
              if (!success) {
                Alert.alert('No se puede eliminar', 'Este fabricante tiene pedidos asociados. Elimina o mueve sus pedidos primero.');
              } else {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
            } catch (e) {
              Alert.alert('No se pudo eliminar', (e as Error).message);
            }
          },
        },
      ]
    );
  }, [deleteManufacturer]);

  const handleDuplicate = useCallback(async (manufacturer: Manufacturer) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const created = await duplicateManufacturer(manufacturer);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Duplicado', `Se creó "${created.name}" con código "${created.code}"`);
    } catch (e) {
      Alert.alert('No se pudo duplicar', (e as Error).message);
    }
  }, [duplicateManufacturer]);

  const openEdit = useCallback((m: Manufacturer) => {
    setSelectedManufacturer(m);
    setFormName(m.name);
    setFormCode(m.code);
    setEditDialogOpen(true);
    setTimeout(animateModal, 10);
  }, [animateModal]);

  const openYears = useCallback((m: Manufacturer) => {
    setSelectedManufacturer(m);
    setSelectedYears(m.active_years || []);
    setYearsDialogOpen(true);
    setTimeout(animateModal, 10);
  }, [animateModal]);

  const toggleYear = useCallback((year: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedYears(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    );
  }, []);

  const saveYears = useCallback(async () => {
    if (!selectedManufacturer) return;
    try {
      await updateManufacturer(selectedManufacturer.id, { active_years: [...selectedYears].sort((a, b) => b - a) });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setYearsDialogOpen(false);
      setSelectedManufacturer(null);
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    }
  }, [selectedManufacturer, selectedYears, updateManufacturer]);

  /** Datos de cada fabricante: nº de pedidos, importe (sin cancelados) y último pedido */
  const stats = useMemo(() => {
    const map = new Map<string, { count: number; amount: number; last: string | null; years: Set<number> }>();
    for (const o of orders) {
      const st = map.get(o.manufacturer_id) ?? { count: 0, amount: 0, last: null, years: new Set<number>() };
      st.count += 1;
      if (o.status !== 'cancelled') st.amount += o.total_with_vat || 0;
      if (!st.last || o.created_at > st.last) st.last = o.created_at;
      st.years.add(o.year);
      map.set(o.manufacturer_id, st);
    }
    return map;
  }, [orders]);

  const totals = useMemo(() => {
    let withOrders = 0;
    for (const m of manufacturers) if ((stats.get(m.id)?.count ?? 0) > 0) withOrders += 1;
    const amount = orders.filter(o => o.status !== 'cancelled').reduce((a, o) => a + (o.total_with_vat || 0), 0);
    return { withOrders, orders: orders.length, amount };
  }, [manufacturers, orders, stats]);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return manufacturers;
    return manufacturers.filter(m => fold(`${m.name} ${m.code}`).includes(q));
  }, [manufacturers, query]);

  /** Años asignados a mano (naranja) + años en los que ya tiene pedidos sin estar asignados (gris) */
  const yearChips = useCallback((item: Manufacturer) => {
    const assigned = new Set(item.active_years ?? []);
    const withOrders = stats.get(item.id)?.years ?? new Set<number>();
    const all = Array.from(new Set([...assigned, ...withOrders])).sort((a, b) => b - a);
    if (!all.length) return <Text style={[styles.noYears, { color: colors.textSecondary }]}>Sin años ni pedidos</Text>;
    return all.map(year => {
      const onlyOrders = !assigned.has(year);
      return (
        <View
          key={year}
          style={[styles.yearBadge, { backgroundColor: onlyOrders ? colors.fill : colors.primarySoft }]}
          accessibilityLabel={onlyOrders ? `${year}: tiene pedidos, sin asignar` : `${year}: asignado`}
        >
          <Text style={[styles.yearBadgeText, { color: onlyOrders ? colors.textSecondary : colors.primary }]}>{year}</Text>
        </View>
      );
    });
  }, [stats, colors]);

  const [menuFor, setMenuFor] = useState<Manufacturer | null>(null);

  const menuButton = (item: Manufacturer) => (
    <Pressable
      onPress={() => setMenuFor(item)}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.menuBtn, { backgroundColor: hovered ? colors.primarySoftAlt : colors.primarySoft }]}
      accessibilityRole="button"
      accessibilityLabel={`Más acciones para ${item.name}`}
      testID={`manufacturer-menu-${item.id}`}
    >
      <MoreHorizontal size={18} color={colors.primary} />
    </Pressable>
  );

  const codeIcon = (item: Manufacturer, size = 44) => (
    <View style={[styles.mIcon, { width: size, height: size, borderRadius: size * 0.25, backgroundColor: colors.brand }]}>
      <Text style={[styles.mIconText, { color: colors.onPrimary, fontSize: size > 40 ? 13 : 11 }]} numberOfLines={1}>{item.code.slice(0, 4)}</Text>
    </View>
  );

  /** Tarjeta de fabricante (ordenador) */
  const renderCard = (item: Manufacturer) => {
    const st = stats.get(item.id);
    const count = st?.count ?? 0;
    return (
      <Pressable
        key={item.id}
        onPress={() => openEdit(item)}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.card,
          { width: cardWidth, backgroundColor: colors.surface, borderColor: hovered ? colors.brand : 'transparent' },
          cardShadow(isDark),
          pressed && { opacity: 0.9 },
          Platform.OS === 'web' && ({ cursor: 'pointer', transitionProperty: 'border-color', transitionDuration: '150ms' } as object),
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, código ${item.code}, ${count} pedidos. Editar`}
        testID={`edit-manufacturer-${item.id}`}
      >
        <View style={[styles.cardBar, { backgroundColor: colors.brand }]} />
        <View style={styles.cardTop}>
          {codeIcon(item)}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
            <Text style={[styles.mfCode, { color: colors.textSecondary }]}>Código {item.code}</Text>
          </View>
          {menuButton(item)}
        </View>
        <View style={[styles.cardStats, { borderTopColor: colors.divider, borderBottomColor: colors.divider }]}>
          <View style={[styles.cardStat, { flex: 0.55 }]}>
            <Text style={[styles.cardStatLabel, { color: colors.textSecondary }]}>Pedidos</Text>
            <Text style={[styles.cardStatValue, { color: colors.text }]}>{count}</Text>
          </View>
          <View style={[styles.cardStat, { flex: 1.45 }]}>
            <Text style={[styles.cardStatLabel, { color: colors.textSecondary }]}>Importe</Text>
            <Text style={[styles.cardStatValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(st?.amount ?? 0)}</Text>
          </View>
          <View style={[styles.cardStat, { flex: 0, minWidth: 96 }]}>
            <Text style={[styles.cardStatLabel, { color: colors.textSecondary }]}>Último pedido</Text>
            <Text style={[styles.cardStatValue, { color: colors.text }]} numberOfLines={1}>{st?.last ? formatDate(st.last) : '—'}</Text>
          </View>
        </View>
        <View style={styles.yearBadges}>{yearChips(item)}</View>
      </Pressable>
    );
  };

  /** Fila de la lista agrupada (móvil y tablet) */
  const renderRow = (item: Manufacturer, index: number) => {
    const st = stats.get(item.id);
    const count = st?.count ?? 0;
    const first = index === 0;
    return (
      <Pressable
        key={item.id}
        onPress={() => openEdit(item)}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.mRow,
          { backgroundColor: (pressed || hovered) ? colors.surfaceAlt : colors.surface },
          !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, código ${item.code}, ${count} pedidos. Editar`}
        testID={`edit-manufacturer-${item.id}`}
      >
        {codeIcon(item, 40)}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={[styles.mfName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.mfCode, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.code} · {count} pedido{count !== 1 ? 's' : ''} · <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCurrency(st?.amount ?? 0)}</Text>
          </Text>
          <View style={[styles.yearBadges, { marginTop: 4 }]}>{yearChips(item)}</View>
        </View>
        {menuButton(item)}
      </Pressable>
    );
  };

  const summary = [
    { label: 'Fabricantes', value: String(manufacturers.length), Icon: Building2 },
    { label: 'Con pedidos', value: String(totals.withOrders), Icon: Layers },
    { label: 'Pedidos en total', value: String(totals.orders), Icon: Package },
    { label: 'Importe total', value: formatCurrency(totals.amount), Icon: Euro, hint: 'sin cancelados' },
  ];
  const summaryTiles = summary.map(t => (
    <View key={t.label} style={[styles.tile, grid ? { flex: 1 } : styles.tileScroll, { backgroundColor: colors.surface }, cardShadow(isDark)]}>
      <View style={[styles.tileIcon, { backgroundColor: colors.brand }]}>
        <t.Icon size={17} color={colors.onPrimary} strokeWidth={2.3} />
      </View>
      <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>{t.value}</Text>
      <Text style={[styles.tileLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {t.label}
        {t.hint ? <Text style={{ fontSize: 12 }}> · {t.hint}</Text> : null}
      </Text>
    </View>
  ));

  const legend = (
    <View style={styles.legend}>
      <View style={[styles.yearBadge, { backgroundColor: colors.primarySoft }]}><Text style={[styles.yearBadgeText, { color: colors.primary }]}>2026</Text></View>
      <Text style={[styles.legendText, { color: colors.textSecondary }]}>año asignado</Text>
      <View style={[styles.yearBadge, { backgroundColor: colors.fill, marginLeft: 8 }]}><Text style={[styles.yearBadgeText, { color: colors.textSecondary }]}>2025</Text></View>
      <Text style={[styles.legendText, { color: colors.textSecondary }]}>tiene pedidos de ese año pero no está asignado</Text>
    </View>
  );

  const openCreate = () => { setFormName(''); setFormCode(''); setCreateDialogOpen(true); setTimeout(animateModal, 10); };

  // ---------- modales con estilo de marca
  const modalButtons = (onCancel: () => void, onConfirm: () => void, confirmLabel: string) => (
    <View style={styles.modalActions}>
      <Pressable style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.modalBtn, { backgroundColor: hovered ? colors.surfaceAlt : colors.fill }]} onPress={onCancel} accessibilityRole="button">
        <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancelar</Text>
      </Pressable>
      <Pressable style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [styles.modalBtn, { backgroundColor: hovered ? colors.primaryDark : colors.primaryFill, opacity: pressed ? 0.85 : 1 }]} onPress={onConfirm} accessibilityRole="button">
        <Text style={[styles.modalBtnText, { color: colors.onPrimary }]}>{confirmLabel}</Text>
      </Pressable>
    </View>
  );
  const modalShell = (visible: boolean, onClose: () => void, title: string, subtitle: string | undefined, children: React.ReactNode) => (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { backgroundColor: colors.overlay, opacity: modalOpacity }]}>
        <Animated.View style={[styles.modalContent, { backgroundColor: colors.surface, transform: [{ scale: modalScale }, { translateY: modalSlide }] }]} accessibilityViewIsModal>
          <View style={[styles.modalBar, { backgroundColor: colors.brand }]} />
          <View style={styles.modalHead}>
            <View style={[styles.tileIcon, { backgroundColor: colors.brand }]}>
              <Building2 size={17} color={colors.onPrimary} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]} accessibilityRole="header">{title}</Text>
              {!!subtitle && <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
            </View>
          </View>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
  const field = (label: string, input: React.ReactNode) => (
    <View style={styles.modalField}>
      <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{label}</Text>
      {input}
    </View>
  );
  const inputStyle = [styles.modalInput, { backgroundColor: colors.fill, color: colors.text }];

  return (
    <View style={[styles.container, { backgroundColor: canvas(colors) }]}>
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={[content, { paddingBottom: bottomSpace }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }, { scale: headerScale }] }}>
          <PageHeader
            title="Fabricantes"
            subtitle={`${manufacturers.length} fabricante${manufacturers.length !== 1 ? 's' : ''}`}
            actions={<Button label="Crear" icon={Plus} variant="primary" onPress={openCreate} accessibilityLabel="Crear fabricante" testID="create-manufacturer-btn" />}
          />
        </Animated.View>

        {manufacturers.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surface }, cardShadow(isDark)]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Building2 size={36} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No hay fabricantes</Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>Crea el primero para poder asignarle pedidos.</Text>
            <View style={{ marginTop: 16 }}>
              <Button label="Crear fabricante" icon={Plus} variant="primary" onPress={openCreate} />
            </View>
          </View>
        ) : (
          <>
            {grid ? (
              <View style={styles.tiles}>{summaryTiles}</View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tilesScroll, { paddingHorizontal: pad }]} style={{ marginHorizontal: -pad, marginBottom: 16 }}>
                {summaryTiles}
              </ScrollView>
            )}

            <SearchField value={query} onChangeText={setQuery} placeholder="Buscar fabricante por nombre o código" testID="search-manufacturers" style={{ marginBottom: 12 }} />
            {legend}

            {shown.length === 0 ? (
              <View style={[styles.noResults, { backgroundColor: colors.surface }]}>
                <Text style={[styles.emptyTitle, { color: colors.text, fontSize: 17 }]}>Ningún fabricante coincide con «{query}»</Text>
                <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>Prueba con otra parte del nombre o con el código.</Text>
              </View>
            ) : grid ? (
              <View style={[styles.cardGrid, { gap: GAP }]}>{shown.map(renderCard)}</View>
            ) : (
              <View style={[styles.groupCard, { backgroundColor: colors.surface }, cardShadow(isDark)]}>{shown.map(renderRow)}</View>
            )}
          </>
        )}
      </ScrollView>

      <SelectSheet
        visible={!!menuFor}
        title={menuFor ? menuFor.name : ''}
        options={[
          { value: 'edit', label: 'Editar nombre y código' },
          { value: 'years', label: 'Asignar años' },
          { value: 'duplicate', label: 'Duplicar fabricante' },
          { value: 'delete', label: 'Eliminar fabricante', destructive: true },
        ]}
        onSelect={v => {
          const m = menuFor;
          if (!m) return;
          if (v === 'edit') openEdit(m);
          else if (v === 'years') openYears(m);
          else if (v === 'duplicate') void handleDuplicate(m);
          else if (v === 'delete') handleDelete(m);
        }}
        onClose={() => setMenuFor(null)}
      />

      {modalShell(createDialogOpen, () => setCreateDialogOpen(false), 'Crear fabricante', 'El código va al principio de las referencias (CÓDIGO-AÑO-NÚMERO).', (
        <>
          {field('Nombre *', <TextInput style={inputStyle} value={formName} onChangeText={setFormName} placeholder="Ej.: Acme Industries" placeholderTextColor={colors.textTertiary} accessibilityLabel="Nombre del fabricante" testID="create-name-input" />)}
          {field('Código *', <TextInput style={inputStyle} value={formCode} onChangeText={(v) => setFormCode(v.toUpperCase())} placeholder="Ej.: ACM" placeholderTextColor={colors.textTertiary} maxLength={30} autoCapitalize="characters" accessibilityLabel="Código del fabricante" testID="create-code-input" />)}
          {modalButtons(() => setCreateDialogOpen(false), handleCreate, 'Crear')}
        </>
      ))}

      {modalShell(editDialogOpen, () => setEditDialogOpen(false), 'Editar fabricante', selectedManufacturer?.name, (
        <>
          {field('Nombre *', <TextInput style={inputStyle} value={formName} onChangeText={setFormName} accessibilityLabel="Nombre del fabricante" testID="edit-name-input" />)}
          {field('Código *', <TextInput style={inputStyle} value={formCode} onChangeText={(v) => setFormCode(v.toUpperCase())} maxLength={30} autoCapitalize="characters" accessibilityLabel="Código del fabricante" testID="edit-code-input" />)}
          {modalButtons(() => { setEditDialogOpen(false); setSelectedManufacturer(null); }, handleEdit, 'Actualizar')}
        </>
      ))}

      {modalShell(yearsDialogOpen, () => setYearsDialogOpen(false), 'Asignar años', selectedManufacturer?.name, (
        <>
          <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>Elige los años en los que trabajas con este fabricante:</Text>
          <View style={styles.yearsGrid}>
            {years.map(year => {
              const on = selectedYears.includes(year);
              return (
                <Pressable
                  key={year}
                  style={({ pressed }) => [styles.yearToggle, { borderColor: on ? colors.primary : 'transparent', backgroundColor: on ? colors.primarySoft : colors.fill, opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => toggleYear(year)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  testID={`year-toggle-${year}`}
                >
                  {on && <Check size={15} color={colors.primary} strokeWidth={2.6} />}
                  <Text style={[styles.yearToggleText, { color: on ? colors.primary : colors.text }]}>{year}</Text>
                </Pressable>
              );
            })}
          </View>
          {modalButtons(() => { setYearsDialogOpen(false); setSelectedManufacturer(null); }, saveYears, 'Guardar')}
        </>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  // resumen
  tiles: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  tilesScroll: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
  tile: { borderRadius: 16, padding: 16, gap: 4 },
  tileScroll: { width: 170 },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileValue: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 14, fontWeight: '600' as const },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 14, paddingHorizontal: 2 },
  legendText: { fontSize: 13 },
  // tarjetas (ordenador)
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderRadius: 18, padding: 18, paddingTop: 20, gap: 14, borderWidth: 1.5, overflow: 'hidden' },
  cardBar: { position: 'absolute', left: 0, right: 0, top: 0, height: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardName: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.3 },
  cardStats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 8 },
  cardStat: { flex: 1, minWidth: 0, gap: 2 },
  cardStatLabel: { fontSize: 12, fontWeight: '600' as const },
  cardStatValue: { fontSize: 16, fontWeight: '700' as const, fontVariant: ['tabular-nums'] },
  // lista (móvil)
  groupCard: { borderRadius: 16, overflow: 'hidden' },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 64 },
  mIcon: { alignItems: 'center', justifyContent: 'center' },
  mIconText: { fontWeight: '800' as const, letterSpacing: 0.2 },
  mfName: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.3 },
  mfCode: { fontSize: 13.5, fontVariant: ['tabular-nums'] },
  menuBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  yearBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  yearBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  yearBadgeText: { fontSize: 13, fontWeight: '700' as const, fontVariant: ['tabular-nums'] },
  noYears: { fontSize: 13, fontStyle: 'italic' as const },
  noResults: { borderRadius: 16, padding: 28, alignItems: 'center', gap: 6 },
  // vacío
  emptyContainer: { borderRadius: 18, padding: 32, alignItems: 'center', marginTop: 8 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.2, textAlign: 'center' },
  emptyDescription: { fontSize: 14, marginTop: 6, textAlign: 'center' },
  // modales
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { borderRadius: 20, padding: 24, paddingTop: 26, width: '100%' as any, maxWidth: 460, overflow: 'hidden' },
  modalBar: { position: 'absolute', left: 0, right: 0, top: 0, height: 4 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  modalTitle: { fontSize: 21, fontWeight: '800' as const, letterSpacing: -0.4 },
  modalSubtitle: { fontSize: 14, marginTop: 2 },
  modalDescription: { fontSize: 14, marginTop: 12, marginBottom: 14 },
  modalField: { marginTop: 16, gap: 6 },
  modalLabel: { fontSize: 13, fontWeight: '600' as const },
  modalInput: { borderRadius: 12, ...webInputReset, paddingHorizontal: 14, height: 48, fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  modalBtn: { flex: 1, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 16, fontWeight: '700' as const },
  yearsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  yearToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, minHeight: 48, borderRadius: 12, borderWidth: 2, minWidth: 90, justifyContent: 'center' },
  yearToggleText: { fontSize: 16, fontWeight: '700' as const, fontVariant: ['tabular-nums'] },
});
