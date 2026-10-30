import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NATIVE_DRIVER } from '@/constants/animation';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Plus, Trash2, Package, Truck, FileText, ScanLine, X } from 'lucide-react-native';
import { LightColors as StaticColors } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { OrderFormData, OrderFormItem, ShippingFormItem, OrderStatus, Customer } from '@/types';
import { calculateItemTotals, calculateShippingTotals, formatCurrency } from '@/utils/calculations';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { webInputReset } from '@/constants/theme';
import DocumentReview from '@/components/DocumentReview';
import { DOC_READ_SUPPORTED, DocReadError, readDocument, releaseReader, type ReadInput } from '@/utils/docread/read';
import { applyReview, buildReview, type ReviewState } from '@/utils/docread/review';
import type { ParsedDoc, ReadResult } from '@/utils/docread/types';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'processing', label: 'Procesando' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const emptyCustomer: Customer = {
  nombre_empresa: '',
  contacto: '',
  departamento: '',
  numero_referencia_pedido: '',
  direccion_1: '',
  direccion_2: '',
  codigo_postal: '',
  provincia: '',
  pais: 'España',
  telefono_1: '',
  telefono_2: '',
  email: '',
  nif: '',
  oferta_proforma: '',
  condiciones_entrega: '',
  condiciones_pago: '',
  numero_factura: '',
  numero_recibo: '',
};

const emptyItem: OrderFormItem = {
  product_name: '',
  quantity: 1,
  costo_unitario: 0,
  tpv_unitario: 0,
  total_sin_iva: 0,
  descuento_porcentaje: 0,
  vat_percentage: 21,
};

const emptyShipping: ShippingFormItem = {
  description: '',
  quantity: 1,
  costo_unitario: 0,
  total_sin_iva: 0,
  vat_percentage: 21,
};

export default function OrderFormScreen() {
  const { colors, isDark } = useTheme();
  const { editOrderId, manufacturerId, year } = useLocalSearchParams<{
    editOrderId?: string;
    manufacturerId?: string;
    year?: string;
  }>();
  const router = useRouter();
  const { orders, manufacturers, addOrder, updateOrder } = useData();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 880 : width;

  const editingOrder = useMemo(
    () => (editOrderId ? orders.find(o => o.id === editOrderId) : null),
    [orders, editOrderId]
  );

  const [formData, setFormData] = useState<OrderFormData>({
    customer: { ...emptyCustomer },
    manufacturer_id: manufacturerId || '',
    year: year ? parseInt(year) : new Date().getFullYear(),
    status: 'pending' as OrderStatus,
    shipping_cost: 0,
    custom_reference: '',
    items: [{ ...emptyItem }],
    shipping_items: [],
  });

  const [selectedManufacturerIndex, setSelectedManufacturerIndex] = useState<number>(-1);
  const [selectedStatusIndex, setSelectedStatusIndex] = useState<number>(0);
  const [scan, setScan] = useState<{ step: string; fraction?: number; fileName: string } | null>(null);
  const isExtracting = !!scan;
  const [scanError, setScanError] = useState<string | null>(null);
  const [review, setReview] = useState<{ read: ReadResult; doc: ParsedDoc; state: ReviewState; fileName: string } | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const scanSignalRef = useRef<{ aborted: boolean }>({ aborted: false });
  const lastFileRef = useRef<ReadInput | null>(null);
  const formRef = useRef(formData);
  formRef.current = formData;

  // Liberar el lector (memoria del OCR) al salir del formulario
  useEffect(() => () => {
    scanSignalRef.current.aborted = true;
    void releaseReader();
  }, []);

  useEffect(() => {
    if (isExtracting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: NATIVE_DRIVER }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: NATIVE_DRIVER }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isExtracting, pulseAnim]);

  // Rellenar el formulario UNA sola vez (si llegan cambios en tiempo real no se pierde lo que estás escribiendo)
  const initializedRef = useRef<string | null>(null);
  useEffect(() => {
    const initKey = editingOrder ? `edit:${editingOrder.id}` : `new:${manufacturerId ?? ''}`;
    if (initializedRef.current === initKey) return;
    if (editingOrder) {
      initializedRef.current = initKey;
      setFormData({
        customer: { ...editingOrder.customer },
        manufacturer_id: editingOrder.manufacturer_id,
        year: editingOrder.year,
        status: editingOrder.status,
        shipping_cost: editingOrder.shipping_cost,
        custom_reference: editingOrder.custom_reference,
        items: editingOrder.items.map(item => ({
          product_name: item.product_name,
          quantity: item.quantity,
          costo_unitario: item.costo_unitario,
          tpv_unitario: item.tpv_unitario,
          total_sin_iva: item.total_sin_iva,
          descuento_porcentaje: item.descuento_porcentaje,
          vat_percentage: item.vat_percentage,
        })),
        shipping_items: (editingOrder.shipping_items || []).map(s => ({
          description: s.description,
          quantity: s.quantity,
          costo_unitario: s.costo_unitario,
          total_sin_iva: s.total_sin_iva,
          vat_percentage: s.vat_percentage,
        })),
      });
      const mIdx = manufacturers.findIndex(m => m.id === editingOrder.manufacturer_id);
      setSelectedManufacturerIndex(mIdx);
      const sIdx = STATUS_OPTIONS.findIndex(s => s.value === editingOrder.status);
      setSelectedStatusIndex(sIdx >= 0 ? sIdx : 0);
    } else {
      if (manufacturerId) {
        const mIdx = manufacturers.findIndex(m => m.id === manufacturerId);
        setSelectedManufacturerIndex(mIdx);
      }
    }
    if (!editingOrder && manufacturers.length > 0) initializedRef.current = initKey;
  }, [editingOrder, manufacturerId, manufacturers]);

  const updateCustomer = useCallback((field: keyof Customer, value: string) => {
    setFormData(prev => ({
      ...prev,
      customer: { ...prev.customer, [field]: value },
    }));
  }, []);

  const updateItem = useCallback((index: number, field: keyof OrderFormItem, value: string | number) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  }, []);

  const addItem = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...emptyItem }],
    }));
  }, []);

  const removeItem = useCallback((index: number) => {
    setFormData(prev => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  }, []);

  const addShippingItem = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormData(prev => ({
      ...prev,
      shipping_items: [...prev.shipping_items, { ...emptyShipping }],
    }));
  }, []);

  const updateShippingItem = useCallback((index: number, field: keyof ShippingFormItem, value: string | number) => {
    setFormData(prev => {
      const newItems = [...prev.shipping_items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, shipping_items: newItems };
    });
  }, []);

  const removeShippingItem = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      shipping_items: prev.shipping_items.filter((_, i) => i !== index),
    }));
  }, []);

  const selectManufacturer = useCallback((index: number) => {
    setSelectedManufacturerIndex(index);
    setFormData(prev => ({ ...prev, manufacturer_id: manufacturers[index]?.id || '' }));
  }, [manufacturers]);

  const selectStatus = useCallback((index: number) => {
    setSelectedStatusIndex(index);
    setFormData(prev => ({ ...prev, status: STATUS_OPTIONS[index].value }));
  }, []);

  /** Lee el documento en el navegador y abre la pantalla de revisión (no toca el formulario). */
  const startRead = useCallback(async (input: ReadInput) => {
    const signal = { aborted: false };
    scanSignalRef.current.aborted = true;
    scanSignalRef.current = signal;
    lastFileRef.current = input;
    setScanError(null);
    setScan({ step: 'Abriendo el archivo…', fileName: input.name || 'documento' });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const seen = new Set<string>();
      const knownCustomers = orders
        .map(o => ({ name: o.customer?.nombre_empresa ?? '', nif: o.customer?.nif ?? '' }))
        .filter(c => (c.name || c.nif) && !seen.has(c.name + c.nif) && seen.add(c.name + c.nif));
      const { read, parsed } = await readDocument(
        input,
        { manufacturers: manufacturers.map(m => ({ id: m.id, name: m.name, code: m.code })), knownCustomers, ownNames: ['AO Gestiones'] },
        prog => {
          if (!signal.aborted) setScan(prev => (prev ? { ...prev, step: prog.step, fraction: prog.fraction } : prev));
        },
        signal,
      );
      if (signal.aborted) return;
      setReview({ read, doc: parsed, fileName: input.name || 'documento', state: buildReview(parsed, formRef.current, formRef.current.manufacturer_id) });
    } catch (e) {
      if (signal.aborted) return;
      const msg = (e as Error)?.message;
      setScanError(e instanceof DocReadError ? msg : `No se pudo leer el documento${msg ? `: ${msg}` : ''}.`);
    } finally {
      if (!signal.aborted) setScan(null);
    }
  }, [orders, manufacturers]);

  const handleScanAction = useCallback(async () => {
    if (!DOC_READ_SUPPORTED) {
      Alert.alert('Disponible en la web', 'La lectura de documentos funciona en la versión web de la app (ao-gestiones-pedidos.vercel.app).');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      await startRead({ uri: asset.uri, mimeType: asset.mimeType ?? undefined, name: asset.name });
    } catch {
      setScanError('No se pudo abrir el selector de archivos.');
    }
  }, [startRead]);

  const cancelExtraction = useCallback(() => {
    scanSignalRef.current.aborted = true;
    setScan(null);
  }, []);

  const applyReviewToForm = useCallback(() => {
    if (!review) return;
    const { form, summary } = applyReview(formRef.current, review.state, review.doc.manufacturerMatch?.id);
    setFormData(form);
    if (form.manufacturer_id !== formRef.current.manufacturer_id) {
      setSelectedManufacturerIndex(manufacturers.findIndex(m => m.id === form.manufacturer_id));
    }
    setReview(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Datos aplicados', `Se han aplicado ${summary}. Revisa el pedido y pulsa «Guardar» para guardarlo.`);
  }, [review, manufacturers]);

  const totals = useMemo(() => {
    const itemTotals = formData.items.map(item => calculateItemTotals(item));
    const shippingTotals = formData.shipping_items.map(s => calculateShippingTotals(s));

    const totalExVat = itemTotals.reduce((sum, i) => sum + i.valor_sin_iva, 0);
    const totalVat = itemTotals.reduce((sum, i) => sum + (i.valor_con_iva - i.valor_sin_iva), 0);
    const shippingTotal = shippingTotals.reduce((sum, s) => sum + s.valor_con_iva, 0);

    return {
      totalExVat,
      totalVat,
      shippingTotal,
      grandTotal: totalExVat + totalVat + shippingTotal + formData.shipping_cost,
    };
  }, [formData.items, formData.shipping_items, formData.shipping_cost]);

  const handleSubmit = useCallback(async () => {
    if (!formData.manufacturer_id) {
      Alert.alert('Error', 'Selecciona un fabricante');
      return;
    }
    if (formData.items.some(item => !item.product_name.trim())) {
      Alert.alert('Error', 'Indica el nombre de todos los productos');
      return;
    }
    if (!Number.isInteger(formData.year) || formData.year < 2000 || formData.year > 2100) {
      Alert.alert('Error', 'Introduce un año válido (2000-2100)');
      return;
    }
    if (formData.items.some(item => item.quantity <= 0)) {
      Alert.alert('Error', 'La cantidad de cada producto debe ser mayor que 0');
      return;
    }

    if (saving) return;
    setSaving(true);
    try {
      if (editingOrder) {
        await updateOrder(editingOrder.id, formData);
      } else {
        await addOrder(formData);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [formData, editingOrder, addOrder, updateOrder, router, saving]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: editingOrder ? 'Editar Pedido' : 'Nuevo Pedido',
          headerRight: () => (
            <Pressable onPress={handleSubmit} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]} testID="header-save-btn">
              <Text style={styles.saveBtnText}>Guardar</Text>
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as any }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {scan ? (
            <View style={[styles.extractingBanner, { backgroundColor: isDark ? colors.surface : colors.primaryDark }]} accessibilityLiveRegion="polite">
              <View style={styles.extractingContent}>
                <Animated.View style={[styles.extractingIconWrap, { opacity: pulseAnim }]}>
                  <ScanLine size={22} color="#FFFFFF" />
                </Animated.View>
                <View style={styles.extractingTextWrap}>
                  <Text style={styles.extractingTitle}>Leyendo documento…</Text>
                  <Text style={styles.extractingSubtitle} numberOfLines={1}>{scan.fileName}</Text>
                </View>
                <Pressable onPress={cancelExtraction} hitSlop={10} style={styles.extractingCancel} accessibilityRole="button" accessibilityLabel="Cancelar lectura">
                  <X size={18} color="rgba(255,255,255,0.8)" />
                </Pressable>
              </View>
              <View style={styles.extractingProgress}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.extractingProgressText} numberOfLines={2}>{scan.step}</Text>
              </View>
              {typeof scan.fraction === 'number' && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(Math.min(1, Math.max(0.03, scan.fraction)) * 100)}%` as any }]} />
                </View>
              )}
            </View>
          ) : (
            <Pressable
              style={[styles.scanBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
              onPress={handleScanAction}
              testID="scan-document-btn"
              accessibilityRole="button"
              accessibilityLabel="Leer datos de un documento"
            >
              <View style={[styles.scanBtnIconWrap, { backgroundColor: colors.primary }]}>
                <ScanLine size={18} color="#FFFFFF" />
              </View>
              <View style={styles.scanBtnTextWrap}>
                <Text style={[styles.scanBtnTitle, { color: colors.text }]}>Leer datos de un documento</Text>
                <Text style={[styles.scanBtnSubtitle, { color: colors.textSecondary }]}>PDF, JPG o PNG · se lee en tu dispositivo, sin enviarlo a ningún servicio</Text>
              </View>
              <FileText size={16} color={colors.primaryLight} />
            </Pressable>
          )}
          {scanError && !scan && (
            <View style={[styles.scanErrorCard, { backgroundColor: colors.errorBg, borderColor: colors.errorBorder }]} accessibilityLiveRegion="assertive">
              <Text style={[styles.scanErrorText, { color: colors.text }]}>{scanError}</Text>
              <View style={styles.scanErrorActions}>
                {lastFileRef.current && (
                  <Pressable onPress={() => lastFileRef.current && startRead(lastFileRef.current)} style={[styles.scanErrorBtn, { backgroundColor: colors.surface }]} accessibilityRole="button">
                    <Text style={[styles.scanErrorBtnText, { color: colors.primary }]}>Reintentar</Text>
                  </Pressable>
                )}
                <Pressable onPress={handleScanAction} style={[styles.scanErrorBtn, { backgroundColor: colors.surface }]} accessibilityRole="button">
                  <Text style={[styles.scanErrorBtnText, { color: colors.primary }]}>Elegir otro archivo</Text>
                </Pressable>
                <Pressable onPress={() => setScanError(null)} style={styles.scanErrorBtn} accessibilityRole="button" accessibilityLabel="Cerrar aviso">
                  <Text style={[styles.scanErrorBtnText, { color: colors.textSecondary }]}>Cerrar</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={isDesktop ? styles.desktopFormRow : undefined}>
            <View style={isDesktop ? styles.desktopFormCol : undefined}>
              <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.sectionNumberText}>1</Text>
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Cliente</Text>
                </View>

                <FormField label="Empresa" value={formData.customer.nombre_empresa} onChangeText={(v) => updateCustomer('nombre_empresa', v)} testID="customer-empresa" />
                <View style={styles.fieldRow}>
                  <FormField label="Contacto" value={formData.customer.contacto} onChangeText={(v) => updateCustomer('contacto', v)} half />
                  <FormField label="Departamento" value={formData.customer.departamento} onChangeText={(v) => updateCustomer('departamento', v)} half />
                </View>
                <FormField label="Dirección 1" value={formData.customer.direccion_1} onChangeText={(v) => updateCustomer('direccion_1', v)} />
                <FormField label="Dirección 2" value={formData.customer.direccion_2} onChangeText={(v) => updateCustomer('direccion_2', v)} />
                <View style={styles.fieldRow}>
                  <FormField label="C. Postal" value={formData.customer.codigo_postal} onChangeText={(v) => updateCustomer('codigo_postal', v)} keyboardType="numeric" half />
                  <FormField label="Provincia" value={formData.customer.provincia} onChangeText={(v) => updateCustomer('provincia', v)} half />
                </View>
                <FormField label="País" value={formData.customer.pais} onChangeText={(v) => updateCustomer('pais', v)} />
                <View style={styles.fieldRow}>
                  <FormField label="Teléfono 1" value={formData.customer.telefono_1} onChangeText={(v) => updateCustomer('telefono_1', v)} keyboardType="phone-pad" half />
                  <FormField label="Teléfono 2" value={formData.customer.telefono_2} onChangeText={(v) => updateCustomer('telefono_2', v)} keyboardType="phone-pad" half />
                </View>
                <FormField label="Email" value={formData.customer.email} onChangeText={(v) => updateCustomer('email', v)} keyboardType="email-address" />
                <View style={styles.fieldRow}>
                  <FormField label="NIF / CIF" value={formData.customer.nif} onChangeText={(v) => updateCustomer('nif', v)} half />
                  <FormField label="Ref. Pedido Cliente" value={formData.customer.numero_referencia_pedido} onChangeText={(v) => updateCustomer('numero_referencia_pedido', v)} half />
                </View>
              </View>
            </View>

            <View style={isDesktop ? styles.desktopFormCol : undefined}>
              <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionNumberBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.sectionNumberText}>2</Text>
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Detalles del Pedido</Text>
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Fabricante *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  <View style={styles.chipRow}>
                    {manufacturers.map((m, i) => (
                      <Pressable
                        key={m.id}
                        style={[styles.chip, { backgroundColor: colors.fill, borderColor: 'transparent' }, selectedManufacturerIndex === i && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => selectManufacturer(i)}
                      >
                        <Text style={[styles.chipText, { color: colors.text }, selectedManufacturerIndex === i && { color: '#FFFFFF' }]}>
                          {m.name} ({m.code})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.fieldRow}>
                  <NumberFormField
                    label="Año *"
                    value={formData.year}
                    onChangeValue={(n) => setFormData(prev => ({ ...prev, year: n }))}
                    integer
                    half
                  />
                  <FormField
                    label="Ref. Manual"
                    value={formData.custom_reference}
                    onChangeText={(v) => setFormData(prev => ({ ...prev, custom_reference: v }))}
                    placeholder="Ej: REF-001"
                    half
                  />
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Estado *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  <View style={styles.chipRow}>
                    {STATUS_OPTIONS.map((s, i) => (
                      <Pressable
                        key={s.value}
                        style={[styles.chip, { backgroundColor: colors.fill, borderColor: 'transparent' }, selectedStatusIndex === i && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => selectStatus(i)}
                      >
                        <Text style={[styles.chipText, { color: colors.text }, selectedStatusIndex === i && { color: '#FFFFFF' }]}>
                          {s.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.fieldRow}>
                  <FormField label="Oferta / Proforma" value={formData.customer.oferta_proforma} onChangeText={(v) => updateCustomer('oferta_proforma', v)} half />
                  <NumberFormField
                    label="Envío Extra (€)"
                    value={formData.shipping_cost}
                    onChangeValue={(n) => setFormData(prev => ({ ...prev, shipping_cost: n }))}
                    half
                  />
                </View>

                <FormField label="Condiciones Entrega" value={formData.customer.condiciones_entrega} onChangeText={(v) => updateCustomer('condiciones_entrega', v)} multiline />
                <FormField label="Condiciones Pago" value={formData.customer.condiciones_pago} onChangeText={(v) => updateCustomer('condiciones_pago', v)} multiline />

                <View style={styles.fieldRow}>
                  <FormField label="Nº Factura" value={formData.customer.numero_factura} onChangeText={(v) => updateCustomer('numero_factura', v)} half />
                  <FormField label="Nº Recibo" value={formData.customer.numero_recibo} onChangeText={(v) => updateCustomer('numero_recibo', v)} half />
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBadge, { backgroundColor: colors.primarySoft }]}>
                <Package size={16} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Productos</Text>
              <View style={{ flex: 1 }} />
              <Pressable style={[styles.addBtn, { backgroundColor: colors.primarySoft, borderColor: 'transparent' }]} onPress={addItem}>
                <Plus size={13} color={colors.primary} />
                <Text style={[styles.addBtnText, { color: colors.primary }]}>Añadir</Text>
              </Pressable>
            </View>

            {formData.items.map((item, index) => (
              <View key={index} style={[styles.itemCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.itemHeader}>
                  <View style={[styles.itemBadge, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.itemBadgeText, { color: colors.primary }]}>#{index + 1}</Text>
                  </View>
                  {formData.items.length > 1 && (
                    <Pressable onPress={() => removeItem(index)} hitSlop={8} style={[styles.deleteBtn, { backgroundColor: colors.errorBg }]}>
                      <Trash2 size={13} color={colors.error} />
                    </Pressable>
                  )}
                </View>

                <FormField label="Producto *" value={item.product_name} onChangeText={(v) => updateItem(index, 'product_name', v)} testID={`product-name-${index}`} />
                <View style={styles.fieldRow}>
                  <NumberFormField label="Cantidad" value={item.quantity} onChangeValue={(n) => updateItem(index, 'quantity', n)} integer emptyValue={1} half />
                  <NumberFormField label="Costo Unit." value={item.costo_unitario} onChangeValue={(n) => updateItem(index, 'costo_unitario', n)} half />
                </View>
                <View style={styles.fieldRow}>
                  <NumberFormField label="Total s/IVA" value={item.total_sin_iva} onChangeValue={(n) => updateItem(index, 'total_sin_iva', n)} third />
                  <NumberFormField label="Dto. %" value={item.descuento_porcentaje} onChangeValue={(n) => updateItem(index, 'descuento_porcentaje', Math.min(100, Math.max(0, n)))} third />
                  <NumberFormField label="IVA %" value={item.vat_percentage} onChangeValue={(n) => updateItem(index, 'vat_percentage', n)} third />
                </View>

                {(() => {
                  const calc = calculateItemTotals(item);
                  return (
                    <View style={[styles.calcRow, { borderTopColor: colors.divider }]}>
                      <Text style={[styles.calcText, { color: colors.textSecondary }]}>Sin IVA: {formatCurrency(calc.valor_sin_iva)}</Text>
                      <Text style={[styles.calcTextBold, { color: colors.primary }]}>Con IVA: {formatCurrency(calc.valor_con_iva)}</Text>
                    </View>
                  );
                })()}
              </View>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBadge, { backgroundColor: colors.warningBg }]}>
                <Truck size={16} color={colors.warning} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Gastos de Envío</Text>
              <View style={{ flex: 1 }} />
              <Pressable style={[styles.addBtn, { backgroundColor: colors.primarySoft, borderColor: 'transparent' }]} onPress={addShippingItem}>
                <Plus size={13} color={colors.primary} />
                <Text style={[styles.addBtnText, { color: colors.primary }]}>Añadir</Text>
              </Pressable>
            </View>

            {formData.shipping_items.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin gastos de envío adicionales</Text>
            )}

            {formData.shipping_items.map((s, index) => (
              <View key={index} style={[styles.itemCard, { backgroundColor: colors.surfaceAlt, borderColor: isDark ? colors.border : colors.warningBorder }]}>
                <View style={styles.itemHeader}>
                  <View style={[styles.itemBadge, { backgroundColor: colors.warningBg }]}>
                    <Text style={[styles.itemBadgeText, { color: colors.warning }]}>#{index + 1}</Text>
                  </View>
                  <Pressable onPress={() => removeShippingItem(index)} hitSlop={8} style={[styles.deleteBtn, { backgroundColor: colors.errorBg }]}>
                    <Trash2 size={13} color={StaticColors.error} />
                  </Pressable>
                </View>

                <FormField label="Descripción" value={s.description} onChangeText={(v) => updateShippingItem(index, 'description', v)} />
                <View style={styles.fieldRow}>
                  <NumberFormField label="Cantidad" value={s.quantity} onChangeValue={(n) => updateShippingItem(index, 'quantity', n)} integer emptyValue={1} third />
                  <NumberFormField label="Costo" value={s.costo_unitario} onChangeValue={(n) => updateShippingItem(index, 'costo_unitario', n)} third />
                  <NumberFormField label="IVA %" value={s.vat_percentage} onChangeValue={(n) => updateShippingItem(index, 'vat_percentage', n)} third />
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.totalsCard, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalsLabel, { color: colors.textSecondary }]}>Subtotal (sin IVA)</Text>
              <Text style={[styles.totalsValue, { color: colors.text }]}>{formatCurrency(totals.totalExVat)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalsLabel, { color: colors.textSecondary }]}>IVA</Text>
              <Text style={[styles.totalsValue, { color: colors.text }]}>{formatCurrency(totals.totalVat)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalsLabel, { color: colors.textSecondary }]}>Envío</Text>
              <Text style={[styles.totalsValue, { color: colors.text }]}>{formatCurrency(totals.shippingTotal + formData.shipping_cost)}</Text>
            </View>
            <View style={[styles.totalDivider, { backgroundColor: colors.border }]} />
            <View style={styles.totalRow}>
              <Text style={[styles.grandTotalLabel, { color: colors.text }]}>Total</Text>
              <Text style={[styles.grandTotalValue, { color: colors.primary }]}>{formatCurrency(totals.grandTotal)}</Text>
            </View>
          </View>

          <Pressable style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.primary, shadowColor: colors.primary, opacity: saving ? 0.6 : pressed ? 0.85 : 1 }]} onPress={handleSubmit} disabled={saving} testID="submit-order-btn">
            <Text style={styles.submitBtnText}>
              {saving ? 'Guardando…' : editingOrder ? 'Actualizar Pedido' : 'Crear Pedido'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      {review && (
        <DocumentReview
          visible
          fileName={review.fileName}
          read={review.read}
          doc={review.doc}
          form={formData}
          state={review.state}
          onChange={st => setReview(r => (r ? { ...r, state: st } : r))}
          orders={orders}
          editingOrderId={editingOrder?.id}
          manufacturerName={manufacturers.find(m => m.id === formData.manufacturer_id)?.name}
          onCancel={() => setReview(null)}
          onApply={applyReviewToForm}
        />
      )}
    </View>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  testID?: string;
  half?: boolean;
  third?: boolean;
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, multiline, testID, half, third }: FormFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[
      formFieldStyles.container,
      half && formFieldStyles.halfContainer,
      third && formFieldStyles.thirdContainer,
    ]}>
      <Text style={[formFieldStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[formFieldStyles.input, { backgroundColor: colors.fill, borderColor: focused ? colors.primary : 'transparent', color: colors.text }, multiline && formFieldStyles.multiline]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        testID={testID}
      />
    </View>
  );
}

interface NumberFormFieldProps {
  label: string;
  value: number;
  onChangeValue: (n: number) => void;
  integer?: boolean;
  emptyValue?: number;
  half?: boolean;
  third?: boolean;
}

/** Acepta coma o punto decimal y conserva lo que se está escribiendo ("12," / "0.") */
export function parseLocaleNumber(text: string, integer?: boolean): number | null {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = integer ? parseInt(cleaned, 10) : parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatForInput(n: number): string {
  return Number.isFinite(n) ? String(n).replace('.', ',') : '';
}

function NumberFormField({ label, value, onChangeValue, integer, emptyValue = 0, half, third }: NumberFormFieldProps) {
  const [text, setText] = useState<string>(formatForInput(value));
  useEffect(() => {
    const current = parseLocaleNumber(text, integer);
    if ((current ?? emptyValue) !== value) setText(formatForInput(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const handleChange = (v: string) => {
    const allowed = integer ? v.replace(/[^0-9]/g, '') : v.replace(/[^0-9.,-]/g, '');
    setText(allowed);
    const n = parseLocaleNumber(allowed, integer);
    onChangeValue(n ?? emptyValue);
  };
  return (
    <FormField
      label={label}
      value={text}
      onChangeText={handleChange}
      keyboardType={integer ? 'numeric' : 'decimal-pad'}
      half={half}
      third={third}
    />
  );
}

const formFieldStyles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  halfContainer: {
    flex: 1,
  },
  thirdContainer: {
    flex: 1,
  },
  label: { fontSize: 13, fontWeight: '500' as const, color: StaticColors.textSecondary, marginBottom: 6,
  },
  input: { backgroundColor: StaticColors.background, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, letterSpacing: -0.2, ...webInputReset,
    color: StaticColors.text,
  },
  multiline: {
    minHeight: 64,
    textAlignVertical: 'top' as const,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: StaticColors.background,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: StaticColors.accent,
    borderRadius: 999,
  },
  saveBtnText: { color: StaticColors.white, fontWeight: '600' as const, fontSize: 15,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  desktopFormRow: {
    flexDirection: 'row',
    gap: 16,
  },
  desktopFormCol: {
    flex: 1,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: StaticColors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
    borderColor: StaticColors.primaryLight,
    borderStyle: 'solid',
    gap: 14,
  },
  scanBtnIconWrap: { width: 40, height: 40, borderRadius: 999,
    backgroundColor: StaticColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnTextWrap: {
    flex: 1,
  },
  scanBtnTitle: { fontSize: 16, fontWeight: '600' as const,
    color: StaticColors.text,
    marginBottom: 2,
  },
  scanBtnSubtitle: { fontSize: 13,
    color: StaticColors.textSecondary,
  },
  extractingBanner: {
    backgroundColor: StaticColors.primaryDark,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  extractingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  extractingIconWrap: { width: 40, height: 40, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractingTextWrap: {
    flex: 1,
  },
  extractingTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: StaticColors.white,
    marginBottom: 2,
  },
  extractingSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  extractingProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  extractingProgressText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500' as const,
  },
  extractingCancel: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  scanErrorCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
    gap: 10,
  },
  scanErrorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  scanErrorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scanErrorBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanErrorBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  section: {
    backgroundColor: StaticColors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: 0,
    borderColor: StaticColors.borderLight,
    shadowColor: StaticColors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  sectionNumberBadge: { width: 26, height: 26, borderRadius: 999,
    backgroundColor: StaticColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: StaticColors.white,
  },
  sectionIconBadge: { width: 26, height: 26, borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 20, fontWeight: '700' as const, color: StaticColors.text, letterSpacing: -0.4,
  },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, color: StaticColors.textSecondary, marginBottom: 8,
  },
  chipScroll: {
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: StaticColors.surfaceAlt,
    borderWidth: 0,
    borderColor: StaticColors.border,
  },
  chipSelected: {
    backgroundColor: StaticColors.primary,
    borderColor: StaticColors.primary,
  },
  chipText: { fontSize: 14,
    color: StaticColors.text,
    fontWeight: '600' as const,
  },
  chipTextSelected: {
    color: StaticColors.white,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999, backgroundColor: StaticColors.primarySoft, borderWidth: 0, borderColor: 'transparent',
  },
  addBtnText: { fontSize: 15,
    color: StaticColors.primary,
    fontWeight: '600' as const,
  },
  itemCard: {
    backgroundColor: StaticColors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0,
    borderColor: StaticColors.border,
    marginBottom: 12,
  },
  shippingItemCard: { borderColor: 'transparent',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  itemBadge: { backgroundColor: StaticColors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  itemBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: StaticColors.primary,
  },
  deleteBtn: { padding: 8, borderRadius: 999,
    backgroundColor: StaticColors.errorBg,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: StaticColors.divider,
  },
  calcText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: StaticColors.textSecondary,
  },
  calcTextBold: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: StaticColors.primary,
  },
  emptyText: {
    fontSize: 14,
    color: StaticColors.textTertiary,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    paddingVertical: 16,
  },
  totalsCard: {
    backgroundColor: StaticColors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: 0,
    borderColor: StaticColors.borderLight,
    shadowColor: StaticColors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalsLabel: { fontSize: 15,
    color: StaticColors.textSecondary,
    fontWeight: '500' as const,
  },
  totalsValue: { fontSize: 16, fontWeight: '500' as const, fontVariant: ['tabular-nums'],
    color: StaticColors.text,
  },
  totalDivider: { height: StyleSheet.hairlineWidth,
    backgroundColor: StaticColors.border,
    marginVertical: 6,
  },
  grandTotalLabel: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: StaticColors.text,
  },
  grandTotalValue: { fontSize: 28, fontWeight: '700' as const, color: StaticColors.primary, letterSpacing: -0.8, fontVariant: ['tabular-nums'],
  },
  submitBtn: {
    backgroundColor: StaticColors.accent,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: StaticColors.accent,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16,
    elevation: 6,
    marginBottom: 24,
  },
  submitBtnText: { color: StaticColors.white, fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2,
  },
});
