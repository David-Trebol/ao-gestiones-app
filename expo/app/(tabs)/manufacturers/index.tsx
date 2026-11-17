import React, { useState, useCallback, useRef, useEffect } from 'react';
import { NATIVE_DRIVER } from '@/constants/animation';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  TextInput,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { Building2, Plus, Check, MoreHorizontal } from 'lucide-react-native';
import { PageHeader, usePageLayout } from '@/components/Page';
import Button from '@/components/Button';
import { canvas , webInputReset } from '@/constants/theme';
import SelectSheet from '@/components/SelectSheet';
import { SystemTint } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { Manufacturer } from '@/types';
import * as Haptics from 'expo-haptics';

export default function ManufacturersScreen() {
  const { manufacturers, years, orders, addManufacturer, updateManufacturer, deleteManufacturer, duplicateManufacturer } = useData();
  const { colors } = useTheme();
  const { width, content, bottomSpace } = usePageLayout();
  // Tabla con columnas cuando hay sitio; en móvil, lista agrupada como en iOS
  const table = width >= 1024;

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

  const getOrderCount = useCallback((mId: string) => {
    return orders.filter(o => o.manufacturer_id === mId).length;
  }, [orders]);

  /** Años asignados a mano + años en los que ya tiene pedidos (estos, en gris) */
  const yearChips = useCallback((item: Manufacturer) => {
    const assigned = new Set(item.active_years ?? []);
    const withOrders = new Set(orders.filter(o => o.manufacturer_id === item.id).map(o => o.year));
    const all = Array.from(new Set([...assigned, ...withOrders])).sort((a, b) => b - a);
    if (!all.length) return <Text style={[styles.noYears, { color: colors.textSecondary }]}>Sin años ni pedidos</Text>;
    return all.map(year => {
      const onlyOrders = !assigned.has(year);
      return (
        <View
          key={year}
          style={[styles.yearBadge, onlyOrders ? { backgroundColor: colors.fill, borderColor: 'transparent' } : { backgroundColor: colors.primarySoft, borderColor: 'transparent' }]}
          accessibilityLabel={onlyOrders ? `${year}: tiene pedidos, sin asignar` : `${year}: asignado`}
        >
          <Text style={[styles.yearBadgeText, { color: onlyOrders ? colors.textSecondary : colors.primary }]}>{year}</Text>
        </View>
      );
    });
  }, [orders, colors]);

  const [menuFor, setMenuFor] = useState<Manufacturer | null>(null);

  const renderItem = useCallback(({ item, index }: { item: Manufacturer; index: number }) => {
    const orderCount = getOrderCount(item.id);
    const first = index === 0;
    return (
      <Pressable
        onPress={() => openEdit(item)}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.mRow,
          { backgroundColor: (pressed || hovered) ? colors.surfaceAlt : colors.surface },
          !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
          first && styles.mRowFirst,
          index === manufacturers.length - 1 && styles.mRowLast,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, código ${item.code}, ${orderCount} pedidos. Editar`}
        testID={`edit-manufacturer-${item.id}`}
      >
        <View style={[styles.mIcon, { backgroundColor: SystemTint.orange }]}>
          <Text style={styles.mIconText}>{item.code.slice(0, 3)}</Text>
        </View>
        {table ? (
          <>
            <View style={[styles.cName, { minWidth: 0 }]}>
              <Text style={[styles.mfName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.mfCode, { color: colors.textSecondary }]}>{item.code}</Text>
            </View>
            <View style={[styles.cYears, styles.yearBadges]}>{yearChips(item)}</View>
            <Text style={[styles.cCount, styles.mCount, { color: colors.text }]}>{orderCount}</Text>
          </>
        ) : (
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={styles.mTop}>
              <Text style={[styles.mfName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.mfCode, { color: colors.textSecondary }]}>{orderCount} pedido{orderCount !== 1 ? 's' : ''}</Text>
            </View>
            <Text style={[styles.mfCode, { color: colors.textSecondary }]}>{item.code}</Text>
            <View style={styles.yearBadges}>{yearChips(item)}</View>
          </View>
        )}
        <Pressable
          onPress={() => setMenuFor(item)}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.menuBtn, { backgroundColor: hovered ? colors.primarySoftAlt : colors.primarySoft }]}
          accessibilityRole="button"
          accessibilityLabel={`Más acciones para ${item.name}`}
          testID={`manufacturer-menu-${item.id}`}
        >
          <MoreHorizontal size={18} color={colors.primary} />
        </Pressable>
      </Pressable>
    );
  }, [getOrderCount, openEdit, colors, table, yearChips, manufacturers.length]);

  return (
    <View style={[styles.container, { backgroundColor: canvas(colors) }]}>
      <View style={[styles.innerContainer, content]}>
        <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }, { scale: headerScale }] }}>
          <PageHeader
            title="Fabricantes"
            subtitle={`${manufacturers.length} fabricante${manufacturers.length !== 1 ? 's' : ''}`}
            actions={
              <Button
                label="Crear"
                icon={Plus}
                variant="primary"
                onPress={() => { setFormName(''); setFormCode(''); setCreateDialogOpen(true); setTimeout(animateModal, 10); }}
                accessibilityLabel="Crear fabricante"
                testID="create-manufacturer-btn"
              />
            }
          />
        </Animated.View>

        {manufacturers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceAlt }]}>
              <Building2 size={38} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No hay fabricantes</Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>Crea tu primer fabricante para comenzar</Text>
          </View>
        ) : (
          <FlatList
            data={manufacturers}
            renderItem={renderItem}
            ListHeaderComponent={
              table ? (
                <View style={styles.tHead}>
                  <View style={{ width: 36 }} />
                  <Text style={[styles.cName, styles.th, { color: colors.textSecondary }]}>Fabricante</Text>
                  <Text style={[styles.cYears, styles.th, { color: colors.textSecondary }]}>Años</Text>
                  <Text style={[styles.cCount, styles.th, { color: colors.textSecondary }]}>Pedidos</Text>
                  <View style={{ width: 40 }} />
                </View>
              ) : null
            }
            ListFooterComponent={
              <Text style={[styles.listFooter, { color: colors.textSecondary }]}>
                Años en azul: asignados al fabricante. En gris: tiene pedidos de ese año pero no está asignado.
              </Text>
            }
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomSpace }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

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

      <Modal visible={createDialogOpen} transparent animationType="none" onRequestClose={() => setCreateDialogOpen(false)}>
        <Animated.View style={[styles.modalOverlay, { backgroundColor: colors.overlay, opacity: modalOpacity }]}>
          <Animated.View style={[styles.modalContent, { backgroundColor: colors.surface, transform: [{ scale: modalScale }, { translateY: modalSlide }] }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Crear Fabricante</Text>
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Nombre *</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={formName} onChangeText={setFormName} placeholder="Ej: Acme Industries" placeholderTextColor={colors.textTertiary} testID="create-name-input" />
            </View>
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Código *</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={formCode} onChangeText={(v) => setFormCode(v.toUpperCase())} placeholder="Ej: ACM" placeholderTextColor={colors.textTertiary} maxLength={30} autoCapitalize="characters" testID="create-code-input" />
            </View>
            <View style={[styles.modalActions, { borderTopColor: colors.divider }]}>
              <Pressable style={({ pressed }) => [styles.modalCancelBtn, { borderColor: colors.border, transform: [{ scale: pressed ? 0.95 : 1 }] }]} onPress={() => setCreateDialogOpen(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.modalConfirmBtn, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.9 : 1 }] }]} onPress={handleCreate}>
                <Text style={styles.modalConfirmText}>Crear</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal visible={editDialogOpen} transparent animationType="none" onRequestClose={() => setEditDialogOpen(false)}>
        <Animated.View style={[styles.modalOverlay, { backgroundColor: colors.overlay, opacity: modalOpacity }]}>
          <Animated.View style={[styles.modalContent, { backgroundColor: colors.surface, transform: [{ scale: modalScale }, { translateY: modalSlide }] }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar Fabricante</Text>
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Nombre *</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={formName} onChangeText={setFormName} testID="edit-name-input" />
            </View>
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Código *</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={formCode} onChangeText={(v) => setFormCode(v.toUpperCase())} maxLength={30} autoCapitalize="characters" testID="edit-code-input" />
            </View>
            <View style={[styles.modalActions, { borderTopColor: colors.divider }]}>
              <Pressable style={({ pressed }) => [styles.modalCancelBtn, { borderColor: colors.border, transform: [{ scale: pressed ? 0.95 : 1 }] }]} onPress={() => { setEditDialogOpen(false); setSelectedManufacturer(null); }}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.modalConfirmBtn, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.9 : 1 }] }]} onPress={handleEdit}>
                <Text style={styles.modalConfirmText}>Actualizar</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal visible={yearsDialogOpen} transparent animationType="none" onRequestClose={() => setYearsDialogOpen(false)}>
        <Animated.View style={[styles.modalOverlay, { backgroundColor: colors.overlay, opacity: modalOpacity }]}>
          <Animated.View style={[styles.modalContent, { backgroundColor: colors.surface, transform: [{ scale: modalScale }, { translateY: modalSlide }] }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Asignar Años</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{selectedManufacturer?.name}</Text>
            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>Selecciona los años activos:</Text>
            <View style={styles.yearsGrid}>
              {years.map(year => (
                <Pressable
                  key={year}
                  style={({ pressed }) => [styles.yearToggle, { borderColor: selectedYears.includes(year) ? colors.primary : colors.border, backgroundColor: selectedYears.includes(year) ? colors.primarySoft : colors.surface, transform: [{ scale: pressed ? 0.9 : 1 }] }]}
                  onPress={() => toggleYear(year)}
                  testID={`year-toggle-${year}`}
                >
                  {selectedYears.includes(year) && <Check size={14} color={colors.primary} />}
                  <Text style={[styles.yearToggleText, { color: selectedYears.includes(year) ? colors.primary : colors.text }]}>
                    {year}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.modalActions, { borderTopColor: colors.divider }]}>
              <Pressable style={({ pressed }) => [styles.modalCancelBtn, { borderColor: colors.border, transform: [{ scale: pressed ? 0.95 : 1 }] }]} onPress={() => { setYearsDialogOpen(false); setSelectedManufacturer(null); }}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.modalConfirmBtn, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.9 : 1 }] }]} onPress={saveYears}>
                <Text style={styles.modalConfirmText}>Guardar</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%' as any,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.6 },
  headerSubtitle: { fontSize: 15,
    marginTop: 2,
  },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  createBtnText: { color: '#FFFFFF', fontWeight: '600' as const, fontSize: 15, letterSpacing: -0.2 },
  listContent: { paddingTop: 4, paddingBottom: 40,
  },
  manufacturerCard: {
    borderRadius: 20,
    padding: 18,
    minHeight: 124,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    borderWidth: 0,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    flex: 1,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mfName: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.3,
  },
  mfCode: { fontSize: 13,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  yearBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
  },
  yearBadge: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, borderWidth: 0,
  },
  yearBadgeText: { fontSize: 13,
    fontWeight: '600' as const,
  },
  noYears: {
    fontSize: 12,
    fontStyle: 'italic' as const,
  },
  orderCountText: { fontSize: 13,
    marginTop: 6,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
    alignContent: 'flex-start',
    width: 80,
    flexShrink: 0,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 9,
  },
  deleteActionBtn: {},
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  emptyDescription: {
    fontSize: 14,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 22,
    padding: 24,
    width: '100%' as any,
    maxWidth: 440,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '700' as const,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 18,
  },
  modalField: {
    marginTop: 18,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 7,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    ...webInputReset,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 26,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalCancelBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  modalConfirmBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  yearsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  yearToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 82,
    justifyContent: 'center',
  },
  yearToggleText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 64 },
  mRowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  mRowLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  mIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  mIconText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.2 },
  mTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  mCount: { fontSize: 16, fontVariant: ['tabular-nums'] },
  menuBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 8 },
  th: { fontSize: 12.5, fontWeight: '600' as const },
  cName: { flex: 2 },
  cYears: { flex: 2 },
  cCount: { width: 80, textAlign: 'right' },
  listFooter: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingTop: 10 },
});
