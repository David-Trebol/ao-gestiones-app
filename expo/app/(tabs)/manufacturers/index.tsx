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
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { Building2, Plus, Edit3, Trash2, Calendar, Check, Copy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { webInputReset } from '@/constants/theme';
import { useData } from '@/contexts/DataContext';
import { Manufacturer } from '@/types';
import * as Haptics from 'expo-haptics';

function AnimatedManufacturerCard({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(12)).current;
  const scaleVal = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    const delay = Math.min(index * 90, 450);
    Animated.parallel([
      Animated.spring(anim, { toValue: 1, friction: 5, tension: 40, delay, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(slideX, { toValue: 0, friction: 5, tension: 40, delay, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(scaleVal, { toValue: 1, friction: 4, tension: 50, delay, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [anim, index, scaleVal, slideX]);

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX: slideX }, { scale: scaleVal }] }}>
      {children}
    </Animated.View>
  );
}

export default function ManufacturersScreen() {
  const { manufacturers, years, orders, addManufacturer, updateManufacturer, deleteManufacturer, duplicateManufacturer } = useData();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 760 : width;

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

  const renderItem = useCallback(({ item, index }: { item: Manufacturer; index: number }) => {
    const orderCount = getOrderCount(item.id);

    return (
      <AnimatedManufacturerCard index={index}>
        <Pressable
          style={({ pressed }) => [styles.manufacturerCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight, shadowColor: colors.cardShadow, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onLongPress={() => handleDuplicate(item)}
          delayLongPress={600}
          testID={`manufacturer-row-${item.id}`}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
              <Building2 size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mfName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.mfCode, { color: colors.textSecondary }]}>{item.code}</Text>
              <View style={styles.yearBadges}>
                {item.active_years && item.active_years.length > 0 ? (
                  [...item.active_years].sort((a, b) => b - a).map(year => (
                    <View key={year} style={[styles.yearBadge, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftAlt }]}>
                      <Text style={[styles.yearBadgeText, { color: colors.primary }]}>{year}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.noYears, { color: colors.textTertiary }]}>Sin años asignados</Text>
                )}
              </View>
              <Text style={[styles.orderCountText, { color: colors.textSecondary }]}>{orderCount} pedido{orderCount !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <Pressable onPress={() => handleDuplicate(item)} style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.fill, opacity: pressed ? 0.6 : 1 }]} hitSlop={8}>
              <Copy size={15} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => openYears(item)} style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surfaceAlt, transform: [{ scale: pressed ? 0.8 : 1 }] }]} hitSlop={8} testID={`assign-years-${item.id}`}>
              <Calendar size={15} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => openEdit(item)} style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surfaceAlt, transform: [{ scale: pressed ? 0.8 : 1 }] }]} hitSlop={8} testID={`edit-manufacturer-${item.id}`}>
              <Edit3 size={15} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => handleDelete(item)} style={({ pressed }) => [styles.actionBtn, styles.deleteActionBtn, { backgroundColor: colors.errorBg, transform: [{ scale: pressed ? 0.8 : 1 }] }]} hitSlop={8} testID={`delete-manufacturer-${item.id}`}>
              <Trash2 size={15} color={colors.error} />
            </Pressable>
          </View>
        </Pressable>
      </AnimatedManufacturerCard>
    );
  }, [getOrderCount, openYears, openEdit, handleDelete, handleDuplicate, colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.innerContainer, { maxWidth: contentMaxWidth }]}>
        <Animated.View style={[styles.headerBar, { opacity: headerFade, transform: [{ translateY: headerSlide }, { scale: headerScale }] }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Fabricantes</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{manufacturers.length} fabricante{manufacturers.length !== 1 ? 's' : ''}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.createBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => { setFormName(''); setFormCode(''); setCreateDialogOpen(true); setTimeout(animateModal, 10); }}
            testID="create-manufacturer-btn"
          >
            <Plus size={15} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Crear</Text>
          </Pressable>
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
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

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
  listContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40, gap: 12,
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
  yearBadgeText: { fontSize: 12,
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
});
