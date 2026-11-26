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
import { Building2, CalendarClock, ChevronDown, ChevronRight, ChevronUp, ClipboardList, Euro, FileText, Package, Plus, Trash2, ScanLine, Truck, X } from 'lucide-react-native';
import SelectSheet from '@/components/SelectSheet';
import { LightColors as StaticColors } from '@/constants/colors';
import { PAGE_MAX, usePageLayout } from '@/components/Page';
import { canvas, cardShadow, glass, webInputReset } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { OrderFormData, OrderFormItem, ShippingFormItem, OrderStatus, Customer } from '@/types';
import { calculateItemTotals, calculateShippingTotals, formatCurrency } from '@/utils/calculations';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DocumentReview from '@/components/DocumentReview';
import DateField from '@/components/DateField';
import ManualRefField from '@/components/ManualRefField';
import DocPreviewPanel, { type DocPreview } from '@/components/DocPreviewPanel';
import { manualRefOwner, nextManualRef, normalizeManualRef, orderRefLabel } from '@/utils/references';
import { useAuth } from '@/contexts/AuthContext';
import { formatISODate, todayISO } from '@/utils/orderFilters';
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
  const { width, height, pad } = usePageLayout();
  // Móvil en horizontal: una sola barra arriba (Cancelar · título y total · Guardar) para dejar sitio al formulario
  const compact = height < 500;
  // Móviles muy estrechos (320 px): total más pequeño y botón corto para que el importe quepa entero
  const tiny = width < 360;
  // Ordenador ancho: dos columnas (cliente y productos | pedido, total y guardar) y productos en tabla
  const wideForm = width >= 1200;
  // La tabla editable de productos necesita ~950 px de columna: solo en pantallas muy anchas; si no, tarjetas
  const productTable = width >= 1680;
  // Mismo ancho máximo que el resto de pantallas
  const insets = useSafeAreaInsets();

  const editingOrder = useMemo(
    () => (editOrderId ? orders.find(o => o.id === editOrderId) : null),
    [orders, editOrderId]
  );

  const [formData, setFormData] = useState<OrderFormData>({
    customer: { ...emptyCustomer },
    manufacturer_id: '', // siempre empieza en «Seleccionar referencia» (también desde una carpeta)
    year: year ? parseInt(year) : new Date().getFullYear(),
    status: 'pending' as OrderStatus,
    shipping_cost: 0,
    custom_reference: '',
    items: [{ ...emptyItem }],
    shipping_items: [],
    expected_date: null,
    owner: '',
    next_action: '',
  });
  const refCode = useMemo(() => manufacturers.find(m => m.id === formData.manufacturer_id)?.code ?? '', [manufacturers, formData.manufacturer_id]);
  const refSuggestion = useMemo(() => nextManualRef(orders, refCode, editingOrder?.id), [orders, refCode, editingOrder?.id]);
  const editingId = editingOrder?.id;
  const refDuplicate = useMemo(() => { const o = manualRefOwner(orders, formData.custom_reference, refCode, editingId); return o ? `${orderRefLabel(o)} ya existe (pedido de ${o.customer?.nombre_empresa || 'otro cliente'}). Revisa el número antes de guardar.` : null; }, [orders, formData.custom_reference, refCode, editingId]);

  const [selectedManufacturerIndex, setSelectedManufacturerIndex] = useState<number>(-1);
  const [mfSheetOpen, setMfSheetOpen] = useState(false);
  const [selectedStatusIndex, setSelectedStatusIndex] = useState<number>(0);
  const [scan, setScan] = useState<{ step: string; fraction?: number; fileName: string } | null>(null);
  const isExtracting = !!scan;
  const [scanError, setScanError] = useState<string | null>(null);
  // Documento leído: se queda visible arriba del formulario para contrastar (solo en memoria)
  const [docPreview, setDocPreview] = useState<DocPreview | null>(null);
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
        expected_date: editingOrder.expected_date ?? null,
        owner: editingOrder.owner ?? '',
        next_action: editingOrder.next_action ?? '',
        items: editingOrder.items.map(item => ({
          item_status: item.item_status,
          supplier_id: item.supplier_id,
          supplier_name: item.supplier_name,
          supplier_log: item.supplier_log,
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
    }
    if (!editingOrder && manufacturers.length > 0) initializedRef.current = initKey;
  }, [editingOrder, manufacturerId, manufacturers]);

  // Si el pedido llegó antes que la lista de fabricantes, marcar su fabricante en cuanto llegue
  useEffect(() => {
    if (selectedManufacturerIndex !== -1 || !formData.manufacturer_id || manufacturers.length === 0) return;
    const mIdx = manufacturers.findIndex(m => m.id === formData.manufacturer_id);
    if (mIdx !== -1) setSelectedManufacturerIndex(mIdx);
  }, [selectedManufacturerIndex, formData.manufacturer_id, manufacturers]);

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
        { manufacturers: manufacturers.map(m => ({ id: m.id, name: m.name, code: m.code })), knownCustomers, ownNames: ['AO Gestiones'], fileName: input.name },
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
    const { form, summary } = applyReview(formRef.current, review.state);
    setFormData(form);
    if (form.manufacturer_id !== formRef.current.manufacturer_id) {
      setSelectedManufacturerIndex(manufacturers.findIndex(m => m.id === form.manufacturer_id));
    }
    if (review.read.previews.length) {
      setDocPreview({
        fileName: review.fileName,
        previews: review.read.previews,
        aspects: review.read.previews.map((_, i) => { const pg = review.read.pages[i]; return pg?.width && pg?.height ? pg.width / pg.height : 0.707; }),
      });
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

  // Errores junto a cada campo (se muestran después del primer intento de guardar)
  const [showErrors, setShowErrors] = useState(false);
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!formData.manufacturer_id) e.manufacturer = 'Elige la referencia de pedido.';
    if (!Number.isInteger(formData.year) || formData.year < 2000 || formData.year > 2100) e.year = 'Escribe un año entre 2000 y 2100.';
    formData.items.forEach((it, i) => {
      if (!it.product_name.trim()) e[`item_name_${i}`] = 'Escribe el nombre del producto.';
      if (!(it.quantity > 0)) e[`item_qty_${i}`] = 'La cantidad debe ser mayor que 0.';
    });
    return e;
  }, [formData]);
  const warnings = useMemo(() => {
    const w: Record<string, string> = {};
    const email = formData.customer.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) w.email = 'El email no parece válido (no impide guardar).';
    return w;
  }, [formData.customer.email]);
  const errorCount = Object.keys(errors).length;
  const err = (k: string) => (showErrors ? errors[k] : undefined);

  // Responsables: usuarios de la app + nombres ya usados en otros pedidos
  const { users, currentUser } = useAuth();
  const ownerOptions = useMemo(() => {
    const names = new Set<string>();
    if (currentUser?.displayName) names.add(currentUser.displayName);
    users.forEach(u => u.active && u.displayName && names.add(u.displayName));
    orders.forEach(o => o.owner?.trim() && names.add(o.owner.trim()));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
  }, [users, currentUser, orders]);
  const expectedLate = !!formData.expected_date && formData.expected_date < todayISO() && formData.status !== 'delivered' && formData.status !== 'cancelled';

  // Autocompletar cliente con pedidos anteriores
  const [empresaFocused, setEmpresaFocused] = useState(false);
  const [autofillNote, setAutofillNote] = useState<string | null>(null);
  const customerSuggestions = useMemo(() => {
    const q = formData.customer.nombre_empresa.trim().toLowerCase();
    if (q.length < 2) return [];
    const seen = new Set<string>();
    return [...orders]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .filter(o => o.id !== editOrderId && o.customer?.nombre_empresa && o.customer.nombre_empresa.toLowerCase().includes(q) && o.customer.nombre_empresa.toLowerCase() !== q)
      .filter(o => {
        const k = `${o.customer.nombre_empresa.toLowerCase()}|${o.customer.nif}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 5);
  }, [orders, formData.customer.nombre_empresa, editOrderId]);

  const pickCustomer = useCallback((o: (typeof orders)[number]) => {
    const keys: (keyof Customer)[] = ['contacto', 'departamento', 'direccion_1', 'direccion_2', 'codigo_postal', 'provincia', 'pais', 'telefono_1', 'telefono_2', 'email', 'nif'];
    let n = 0;
    setFormData(prev => {
      const c = { ...prev.customer, nombre_empresa: o.customer.nombre_empresa };
      for (const k of keys) {
        const empty = !c[k]?.trim() || (k === 'pais' && c[k] === 'España' && !prev.customer.direccion_1);
        if (empty && o.customer[k]?.trim() && c[k] !== o.customer[k]) {
          c[k] = o.customer[k];
          n++;
        }
      }
      return { ...prev, customer: c };
    });
    setEmpresaFocused(false);
    setTimeout(() => setAutofillNote(n ? `Se han completado ${n} campos vacíos con los datos del pedido ${o.reference_number}. Los que ya tenías no se han cambiado.` : `Cliente elegido. No había campos vacíos que completar.`), 0);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (saving) return;
    setSaving(true);
    const toSave = { ...formData, custom_reference: normalizeManualRef(formData.custom_reference, refCode) };
    try {
      if (editingOrder) {
        await updateOrder(editingOrder.id, toSave);
      } else {
        await addOrder(toSave);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [formData, errors, editingOrder, addOrder, updateOrder, router, saving, refCode]);

  const docsList = [
    formData.customer.numero_referencia_pedido && `Pedido ${formData.customer.numero_referencia_pedido}`,
    formData.customer.oferta_proforma && `Oferta ${formData.customer.oferta_proforma}`,
    formData.customer.numero_factura && `Factura ${formData.customer.numero_factura}`,
    formData.customer.numero_recibo && `Recibo ${formData.customer.numero_recibo}`,
    formData.customer.condiciones_entrega && 'Condiciones de entrega',
    formData.customer.condiciones_pago && 'Condiciones de pago',
  ].filter(Boolean) as string[];
  const docsHaveData = docsList.length > 0;
  const docsSummary = docsHaveData ? docsList.join(' · ') : undefined;
  const followList = [
    formData.expected_date && `Previsto ${formatISODate(formData.expected_date)}`,
    formData.owner && formData.owner,
    formData.next_action && formData.next_action,
  ].filter(Boolean) as string[];

  const documentsSection = (
    <FormSection
      title="Documentos y condiciones"
      subtitle="Opcional"
      icon={FileText}
      collapsible
      startOpen={docsHaveData}
      summary={docsSummary}
    >
      <FormField label="Oferta / proforma" value={formData.customer.oferta_proforma} onChangeText={(v) => updateCustomer('oferta_proforma', v)} />
      <View style={styles.fieldRow}>
        <FormField label="Nº factura" value={formData.customer.numero_factura} onChangeText={(v) => updateCustomer('numero_factura', v)} half />
        <FormField label="Nº recibo / albarán" value={formData.customer.numero_recibo} onChangeText={(v) => updateCustomer('numero_recibo', v)} half />
      </View>
      <FormField label="Condiciones de entrega" value={formData.customer.condiciones_entrega} onChangeText={(v) => updateCustomer('condiciones_entrega', v)} multiline placeholder="Ej.: 3-4 semanas, portes pagados" />
      <FormField label="Condiciones de pago" value={formData.customer.condiciones_pago} onChangeText={(v) => updateCustomer('condiciones_pago', v)} multiline placeholder="Ej.: transferencia a 30 días" />
    </FormSection>
  );

  const submitButton = (
    <Pressable
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.submitBtn, compact && styles.submitBtnCompact, { backgroundColor: hovered ? colors.primaryDark : colors.primaryFill, opacity: saving ? 0.6 : pressed ? 0.85 : 1 }]}
      onPress={handleSubmit}
      disabled={saving}
      testID="submit-order-btn"
      accessibilityRole="button"
      accessibilityState={{ disabled: saving, busy: saving }}
    >
      {saving && <ActivityIndicator size="small" color="#fff" />}
      <Text style={[styles.submitBtnText, (compact || tiny) && { fontSize: 15 }]}>{saving ? 'Guardando…' : compact || tiny ? (editingOrder ? 'Guardar' : 'Crear') : editingOrder ? 'Guardar cambios' : 'Crear pedido'}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: canvas(colors) }]}>
      <Stack.Screen options={{ title: editingOrder ? 'Editar pedido' : 'Nuevo pedido', headerShown: false }} />

      {/* Barra superior como la de una hoja de iOS: Cancelar · título · Leer documento. Guardar va abajo, con el total. */}
      <View style={[styles.topBar, { paddingTop: insets.top, borderBottomColor: colors.divider }, glass(colors.headerBackground, 24)]}>
        <View style={[styles.topBarInner, compact && { height: 48 }, { maxWidth: PAGE_MAX, paddingHorizontal: pad - 8 }]}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.topBtn, hovered && { backgroundColor: colors.fill }]}
            accessibilityRole="button"
            testID="form-cancel"
          >
            <Text style={[styles.topBtnText, { color: colors.primary }]}>Cancelar</Text>
          </Pressable>
          <View style={[styles.topTitleWrap, width < 360 && { left: 92, right: 56 }, compact && { left: 120, right: 230 }]} pointerEvents="none">
            <Text style={[styles.topTitleText, { color: colors.text }]} numberOfLines={1} accessibilityRole="header">
              {editingOrder ? orderRefLabel(editingOrder) : 'Nuevo pedido'}
            </Text>
            {compact && (
              <Text style={[styles.topTotal, { color: showErrors && errorCount > 0 ? colors.error : colors.textSecondary }]} numberOfLines={1}>
                {showErrors && errorCount > 0 ? (errorCount === 1 ? 'Falta 1 dato obligatorio' : `Faltan ${errorCount} datos obligatorios`) : `Total ${formatCurrency(totals.grandTotal)}`}
              </Text>
            )}
          </View>
          <View style={styles.topRight}>
          <Pressable
            onPress={handleScanAction}
            disabled={!!scan}
            style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [styles.scanPill, { backgroundColor: hovered || pressed ? colors.primarySoftAlt : colors.primarySoft, opacity: scan ? 0.5 : 1 }]}
            testID="scan-document-btn"
            accessibilityRole="button"
            accessibilityLabel="Leer datos de un documento (PDF o foto)"
          >
            <ScanLine size={17} color={colors.primary} />
            {width >= 420 && !compact && <Text style={[styles.scanPillText, { color: colors.primary }]}>Leer documento</Text>}
          </Pressable>
          {compact && submitButton}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { maxWidth: PAGE_MAX, alignSelf: 'center' as const, width: '100%' as any, paddingHorizontal: pad }]}
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
          ) : null}
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

          {DOC_READ_SUPPORTED && !editingOrder && !scan && !docPreview && (
            <Pressable
              onPress={handleScanAction}
              style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [styles.scanBtn, { backgroundColor: hovered || pressed ? colors.primarySoftAlt : colors.primarySoft }]}
              accessibilityRole="button"
              accessibilityLabel="Rellenar desde PDF o foto"
              testID="scan-document-big"
            >
              <View style={[styles.scanBtnIconWrap, { backgroundColor: colors.primary }]}>
                <ScanLine size={20} color="#FFFFFF" />
              </View>
              <View style={styles.scanBtnTextWrap}>
                <Text style={[styles.scanBtnTitle, { color: colors.text }]}>Rellenar desde PDF o foto</Text>
                <Text style={[styles.scanBtnSubtitle, { color: colors.textSecondary }]}>Sube la oferta, proforma o factura y se rellena solo. Se lee en tu dispositivo.</Text>
              </View>
              <ChevronRight size={18} color={colors.primary} />
            </Pressable>
          )}

          <Text style={[styles.legend, { color: colors.textSecondary }]}>
            Los campos con <Text style={{ color: colors.error }}>*</Text> son obligatorios.
          </Text>

          {docPreview && <DocPreviewPanel doc={docPreview} onRemove={() => setDocPreview(null)} />}

          {(() => {
            // ---------- Pedido: fabricante, año, ref. manual y estado
            const pedidoSection = (
              <FormSection title="Pedido" subtitle="Referencia, año y estado" icon={ClipboardList}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Referencia de pedido <Text style={{ color: colors.error }}>*</Text>
                </Text>
                {manufacturers.length === 0 ? (
                  <Text style={[styles.help, { color: colors.textSecondary, marginBottom: 14 }]}>No hay referencias de pedido: créalas en «Referencias de pedido».</Text>
                ) : (
                  <Pressable
                    onPress={() => setMfSheetOpen(true)}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
                      styles.selectField,
                      { backgroundColor: colors.fill, borderColor: err('manufacturer') ? colors.error : 'transparent' },
                      hovered && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Referencia de pedido: ${manufacturers[selectedManufacturerIndex] ? manufacturers[selectedManufacturerIndex].name : 'sin elegir'}. Cambiar`}
                    testID="manufacturer-select"
                  >
                    <Text style={[styles.selectText, { color: manufacturers[selectedManufacturerIndex] ? colors.text : colors.textTertiary }]} numberOfLines={1}>
                      {manufacturers[selectedManufacturerIndex] ? `${manufacturers[selectedManufacturerIndex].name} (${manufacturers[selectedManufacturerIndex].code})` : 'Seleccionar referencia'}
                    </Text>
                    <ChevronDown size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
                {!!err('manufacturer') && <Text style={[styles.errorText, { color: colors.error }]}>{err('manufacturer')}</Text>}

                <View style={[styles.fieldRow, { flexWrap: 'wrap', columnGap: 12, rowGap: 0 }]}>
                  <View style={styles.yearField}>
                    <NumberFormField label="Año" required value={formData.year} onChangeValue={(n) => setFormData(prev => ({ ...prev, year: n }))} integer half error={err('year')} />
                  </View>
                  <ManualRefField
                    code={refCode}
                    year={formData.year}
                    value={formData.custom_reference}
                    onChange={(v) => setFormData(prev => ({ ...prev, custom_reference: v }))}
                    suggestion={refSuggestion}
                    duplicateOf={refDuplicate}
                    style={styles.refField}
                  />
                </View>
                <Text style={[styles.help, { color: colors.textSecondary, marginTop: -6, marginBottom: 12 }]}>
                  {refCode ? `Vuestra referencia: ${refCode}- y el número. El año va aparte. Si la dejas vacía, se usa la automática (${refCode}-${formData.year}-…).` : 'Elige la referencia de pedido para numerar el pedido.'}
                </Text>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Estado <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <View style={styles.chipWrap} accessibilityRole="radiogroup" accessibilityLabel="Estado">
                  {STATUS_OPTIONS.map((st, i) => (
                    <Pressable
                      key={st.value}
                      style={[styles.chip, { backgroundColor: colors.fill, borderColor: 'transparent' }, selectedStatusIndex === i && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => selectStatus(i)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: selectedStatusIndex === i }}
                    >
                      <Text style={[styles.chipText, { color: colors.text }, selectedStatusIndex === i && { color: isDark ? colors.onPrimary : '#FFFFFF' }]}>{st.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </FormSection>
            );

            // ---------- Cliente, en el mismo orden que la hoja de Excel del propietario
            const clienteSection = (
              <FormSection title="Cliente" subtitle="Escribe el nombre para reutilizar un cliente de pedidos anteriores" icon={Building2}>
                <View style={{ zIndex: 10 }}>
                  <FormField
                    label="Empresa"
                    value={formData.customer.nombre_empresa}
                    onChangeText={(v) => {
                      updateCustomer('nombre_empresa', v);
                      setAutofillNote(null);
                      setEmpresaFocused(true);
                    }}
                    onFocus={() => setEmpresaFocused(true)}
                    onBlur={() => setTimeout(() => setEmpresaFocused(false), 200)}
                    testID="customer-empresa"
                    autoComplete="organization"
                  />
                  {empresaFocused && customerSuggestions.length > 0 && (
                    <View style={[styles.suggestions, width < 768 && styles.suggestionsInline, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="menu">
                      <Text style={[styles.suggestTitle, { color: colors.textSecondary }]}>Clientes de pedidos anteriores</Text>
                      {customerSuggestions.map(o => (
                        <Pressable
                          key={o.id}
                          onPress={() => pickCustomer(o)}
                          style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [styles.suggestion, { borderTopColor: colors.divider }, (hovered || pressed) && { backgroundColor: colors.fill }]}
                          accessibilityRole="menuitem"
                        >
                          <Text style={[styles.suggestName, { color: colors.text }]}>{o.customer.nombre_empresa}</Text>
                          <Text style={[styles.help, { color: colors.textSecondary }]} numberOfLines={1}>
                            {[o.customer.nif, o.customer.contacto, o.customer.provincia].filter(Boolean).join(' · ') || o.reference_number}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
                {!!autofillNote && <Text style={[styles.note, { color: colors.success, backgroundColor: colors.successBg }]}>{autofillNote}</Text>}
                <View style={styles.fieldGrid}>
                  <FormField label="Contacto" value={formData.customer.contacto} onChangeText={(v) => updateCustomer('contacto', v)} grid autoComplete="name" />
                  <FormField label="Departamento" value={formData.customer.departamento} onChangeText={(v) => updateCustomer('departamento', v)} grid />
                  <FormField label="Nº pedido del cliente" value={formData.customer.numero_referencia_pedido} onChangeText={(v) => updateCustomer('numero_referencia_pedido', v)} grid />
                  <FormField label="Dirección" value={formData.customer.direccion_1} onChangeText={(v) => updateCustomer('direccion_1', v)} placeholder="Calle y número" autoComplete="street-address" grid />
                  <FormField label="Dirección (2)" value={formData.customer.direccion_2} onChangeText={(v) => updateCustomer('direccion_2', v)} placeholder="Piso, nave, población…" grid />
                  <FormField label="Código postal" value={formData.customer.codigo_postal} onChangeText={(v) => updateCustomer('codigo_postal', v)} keyboardType="number-pad" autoComplete="postal-code" grid />
                  <FormField label="Provincia" value={formData.customer.provincia} onChangeText={(v) => updateCustomer('provincia', v)} grid />
                  <FormField label="País" value={formData.customer.pais} onChangeText={(v) => updateCustomer('pais', v)} autoComplete="country" grid />
                  <FormField label="NIF / CIF" value={formData.customer.nif} onChangeText={(v) => updateCustomer('nif', v.toUpperCase())} autoCapitalize="characters" grid />
                  <FormField label="Teléfono" value={formData.customer.telefono_1} onChangeText={(v) => updateCustomer('telefono_1', v)} keyboardType="phone-pad" autoComplete="tel" grid />
                  <FormField label="Teléfono 2" value={formData.customer.telefono_2} onChangeText={(v) => updateCustomer('telefono_2', v)} keyboardType="phone-pad" grid />
                  <FormField label="Email" value={formData.customer.email} onChangeText={(v) => updateCustomer('email', v.trim())} keyboardType="email-address" autoCapitalize="none" autoComplete="email" hint={warnings.email} grid />
                </View>
              </FormSection>
            );

            // ---------- Productos: tabla editable en pantallas anchas, tarjetas en móvil
            const productosSection = (
              <FormSection
                title={`Productos · ${formData.items.length}`}
                subtitle="Pon el precio de venta unitario o el importe de la línea. Si rellenas los dos, se usa el importe de la línea."
                icon={Package}
                flush={productTable}
                action={
                  <Pressable style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.addBtn, { backgroundColor: hovered ? colors.primarySoftAlt : colors.primarySoft }]} onPress={addItem} accessibilityRole="button" accessibilityLabel="Añadir producto" testID="add-item-btn">
                    <Plus size={14} color={colors.primary} />
                    <Text style={[styles.addBtnText, { color: colors.primary }]}>Añadir producto</Text>
                  </Pressable>
                }
              >
                {productTable ? (
                  <View>
                    <View style={[styles.tRow, styles.tHead, { borderBottomColor: colors.divider }]}>
                      <Text style={[styles.tTh, styles.tQty, { color: colors.textSecondary }]}>Cant.</Text>
                      <Text style={[styles.tTh, styles.tName, { color: colors.textSecondary }]}>Equipo y referencia</Text>
                      <Text style={[styles.tTh, styles.tMoney, { color: colors.textSecondary }]}>Precio venta ud.</Text>
                      <Text style={[styles.tTh, styles.tMoney, { color: colors.textSecondary }]}>Importe antes de dto.</Text>
                      <Text style={[styles.tTh, styles.tPct, { color: colors.textSecondary }]}>Dto. %</Text>
                      <Text style={[styles.tTh, styles.tPct, { color: colors.textSecondary }]}>IVA %</Text>
                      <Text style={[styles.tTh, styles.tMoney, { color: colors.textSecondary }]}>Coste ud.</Text>
                      <Text style={[styles.tTh, styles.tCalc, { color: colors.textSecondary }]}>Calculado</Text>
                      <View style={styles.tDel} />
                    </View>
                    {formData.items.map((item, index) => {
                      const calc = calculateItemTotals(item);
                      return (
                        <View key={index} style={[styles.tRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
                          <View style={styles.tQty}>
                            <NumberFormField bare align="center" label="Cantidad" required value={item.quantity} onChangeValue={(n) => updateItem(index, 'quantity', n)} integer emptyValue={1} error={err(`item_qty_${index}`)} />
                          </View>
                          <View style={styles.tName}>
                            <FormField bare label="Producto" required value={item.product_name} onChangeText={(v) => updateItem(index, 'product_name', v)} testID={`product-name-${index}`} error={err(`item_name_${index}`)} placeholder="Equipo, modelo y referencia" multiline={item.product_name.length > 50} />
                            {!!err(`item_name_${index}`) && <Text style={[styles.tErr, { color: colors.error }]}>{err(`item_name_${index}`)}</Text>}
                          </View>
                          <View style={styles.tMoney}><NumberFormField bare align="right" label="Precio venta unit. (sin IVA)" value={item.tpv_unitario} onChangeValue={(n) => updateItem(index, 'tpv_unitario', n)} /></View>
                          <View style={styles.tMoney}><NumberFormField bare align="right" label="Importe línea antes de dto." value={item.total_sin_iva} onChangeValue={(n) => updateItem(index, 'total_sin_iva', n)} /></View>
                          <View style={styles.tPct}><NumberFormField bare align="right" label="Descuento %" value={item.descuento_porcentaje} onChangeValue={(n) => updateItem(index, 'descuento_porcentaje', Math.min(100, Math.max(0, n)))} /></View>
                          <View style={styles.tPct}><NumberFormField bare align="right" label="IVA %" value={item.vat_percentage} onChangeValue={(n) => updateItem(index, 'vat_percentage', n)} /></View>
                          <View style={styles.tMoney}><NumberFormField bare align="right" label="Coste unitario (fabricante)" value={item.costo_unitario} onChangeValue={(n) => updateItem(index, 'costo_unitario', n)} /></View>
                          <View style={styles.tCalc} accessibilityLabel={`Calculado: ${formatCurrency(calc.valor_sin_iva)} sin IVA, ${formatCurrency(calc.valor_con_iva)} con IVA`}>
                            <Text style={[styles.tCalcMain, { color: colors.text }]} numberOfLines={1}>{formatCurrency(calc.valor_sin_iva)}</Text>
                            <Text style={[styles.tCalcSub, { color: colors.textSecondary }]} numberOfLines={1}>con IVA {formatCurrency(calc.valor_con_iva)}</Text>
                            {item.costo_unitario > 0 && (
                              <Text style={[styles.tCalcSub, { color: calc.beneficio_bruto >= 0 ? colors.success : colors.error, fontWeight: '600' }]} numberOfLines={1}>
                                benef. {formatCurrency(calc.beneficio_bruto)}
                              </Text>
                            )}
                          </View>
                          <View style={styles.tDel}>
                            {formData.items.length > 1 && (
                              <Pressable onPress={() => removeItem(index)} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.tDelBtn, hovered && { backgroundColor: colors.errorBg }]} accessibilityRole="button" accessibilityLabel={`Quitar línea ${index + 1}`}>
                                <Trash2 size={16} color={colors.error} />
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <>
                    {formData.items.map((item, index) => {
                      const calc = calculateItemTotals(item);
                      return (
                        <View key={index} style={[styles.itemCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <View style={styles.itemHeader}>
                            <Text style={[styles.itemTitle, { color: colors.textSecondary }]}>Línea {index + 1}</Text>
                            {formData.items.length > 1 && (
                              <Pressable onPress={() => removeItem(index)} hitSlop={8} style={[styles.deleteBtn, { backgroundColor: colors.errorBg }]} accessibilityRole="button" accessibilityLabel={`Quitar línea ${index + 1}`}>
                                <Trash2 size={14} color={colors.error} />
                              </Pressable>
                            )}
                          </View>
                          <FormField label="Producto" required value={item.product_name} onChangeText={(v) => updateItem(index, 'product_name', v)} testID={`product-name-${index}`} error={err(`item_name_${index}`)} multiline={item.product_name.length > 60} />
                          <View style={styles.fieldGrid}>
                            <NumberFormField label="Cantidad" required value={item.quantity} onChangeValue={(n) => updateItem(index, 'quantity', n)} integer emptyValue={1} grid error={err(`item_qty_${index}`)} />
                            <NumberFormField label="Precio venta unit. (sin IVA)" value={item.tpv_unitario} onChangeValue={(n) => updateItem(index, 'tpv_unitario', n)} grid />
                            <NumberFormField label="Importe línea antes de dto." value={item.total_sin_iva} onChangeValue={(n) => updateItem(index, 'total_sin_iva', n)} grid />
                            <NumberFormField label="Descuento %" value={item.descuento_porcentaje} onChangeValue={(n) => updateItem(index, 'descuento_porcentaje', Math.min(100, Math.max(0, n)))} grid />
                            <NumberFormField label="IVA %" value={item.vat_percentage} onChangeValue={(n) => updateItem(index, 'vat_percentage', n)} grid />
                            <NumberFormField label="Coste unitario (fabricante)" value={item.costo_unitario} onChangeValue={(n) => updateItem(index, 'costo_unitario', n)} grid />
                          </View>
                          <View style={[styles.calcRow, { borderTopColor: colors.divider }]} accessibilityLabel={`Calculado: ${formatCurrency(calc.valor_sin_iva)} sin IVA`}>
                            <Text style={[styles.calcTag, { color: colors.textSecondary, backgroundColor: colors.fill }]}>Calculado</Text>
                            <Text style={[styles.calcText, { color: colors.textSecondary }]}>Neto sin IVA <Text style={{ color: colors.text, fontWeight: '600' }}>{formatCurrency(calc.valor_sin_iva)}</Text></Text>
                            <Text style={[styles.calcText, { color: colors.textSecondary }]}>Con IVA <Text style={{ color: colors.text, fontWeight: '600' }}>{formatCurrency(calc.valor_con_iva)}</Text></Text>
                            {item.costo_unitario > 0 && (
                              <Text style={[styles.calcText, { color: colors.textSecondary }]}>
                                Beneficio <Text style={{ color: calc.beneficio_bruto >= 0 ? colors.success : colors.error, fontWeight: '600' }}>{formatCurrency(calc.beneficio_bruto)}</Text>
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
              </FormSection>
            );

            // ---------- Resumen: total y guardar (en ordenador, fijo a la derecha mientras te desplazas)
            const resumenCard = (
              <View style={[styles.totalsCard, { backgroundColor: colors.surface }, cardShadow(isDark)]}>
                <View style={styles.totalsHead}>
                  <View style={[formFieldStyles.sectionIcon, { backgroundColor: colors.brand }]}>
                    <Euro size={16} color={colors.onPrimary} strokeWidth={2.3} />
                  </View>
                  <Text style={[formFieldStyles.sectionTitle, { color: colors.text, flex: 1 }]} accessibilityRole="header">Resumen</Text>
                  <Text style={[styles.calcTag, { color: colors.textSecondary, backgroundColor: colors.fill }]}>Calculado</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalsLabel, { color: colors.textSecondary }]}>Productos (sin IVA)</Text>
                  <Text style={[styles.totalsValue, { color: colors.text }]}>{formatCurrency(totals.totalExVat)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalsLabel, { color: colors.textSecondary }]}>IVA de los productos</Text>
                  <Text style={[styles.totalsValue, { color: colors.text }]}>{formatCurrency(totals.totalVat)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalsLabel, { color: colors.textSecondary }]}>Gastos de envío (con IVA)</Text>
                  <Text style={[styles.totalsValue, { color: colors.text }]}>{formatCurrency(totals.shippingTotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalsLabel, { color: colors.textSecondary }]}>Envío extra</Text>
                  <Text style={[styles.totalsValue, { color: colors.text }]}>{formatCurrency(formData.shipping_cost)}</Text>
                </View>
                <View style={[styles.grandRow, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.grandTotalLabel, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.grandTotalValue, { color: colors.text }]}>{formatCurrency(totals.grandTotal)}</Text>
                </View>
                {wideForm && !compact && (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {showErrors && errorCount > 0 && (
                      <Text style={[styles.saveBarError, { color: colors.error }]} accessibilityLiveRegion="assertive">
                        {errorCount === 1 ? 'Falta 1 dato obligatorio' : `Faltan ${errorCount} datos obligatorios`}: están marcados en rojo.
                      </Text>
                    )}
                    {submitButton}
                  </View>
                )}
              </View>
            );

            return wideForm ? (
              // Ordenador: cliente y productos a la izquierda; pedido, total y guardar a la derecha (fijos al desplazarse)
              <View style={styles.formCols}>
                <View style={styles.formMain}>
                  {clienteSection}
                  {documentsSection}
                  {productosSection}
                  <FormSection
                    title="Envío"
                    icon={Truck}
                    subtitle="«Gastos de envío» son líneas de portes con su IVA. «Envío extra» es un importe fijo que se suma tal cual al total, sin añadirle IVA."
                    action={
                      <Pressable style={[styles.addBtn, { backgroundColor: colors.primarySoft }]} onPress={addShippingItem} accessibilityRole="button" accessibilityLabel="Añadir gasto de envío">
                        <Plus size={14} color={colors.primary} />
                        <Text style={[styles.addBtnText, { color: colors.primary }]}>Añadir gasto</Text>
                      </Pressable>
                    }
                  >
                    {formData.shipping_items.length === 0 && <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin gastos de envío</Text>}
                    {formData.shipping_items.map((sh, index) => {
                      const st = calculateShippingTotals(sh);
                      return (
                        <View key={index} style={[styles.itemCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <View style={styles.itemHeader}>
                            <Text style={[styles.itemTitle, { color: colors.textSecondary }]}>Gasto de envío {index + 1}</Text>
                            <Pressable onPress={() => removeShippingItem(index)} hitSlop={8} style={[styles.deleteBtn, { backgroundColor: colors.errorBg }]} accessibilityRole="button" accessibilityLabel={`Quitar gasto de envío ${index + 1}`}>
                              <Trash2 size={14} color={colors.error} />
                            </Pressable>
                          </View>
                          <FormField label="Descripción" value={sh.description} onChangeText={(v) => updateShippingItem(index, 'description', v)} placeholder="Ej.: Transporte urgente" />
                          <View style={styles.fieldGrid}>
                            <NumberFormField label="Cantidad" value={sh.quantity} onChangeValue={(n) => updateShippingItem(index, 'quantity', n)} integer emptyValue={1} grid />
                            <NumberFormField label="Coste unit. (sin IVA)" value={sh.costo_unitario} onChangeValue={(n) => updateShippingItem(index, 'costo_unitario', n)} grid />
                            <NumberFormField label="IVA %" value={sh.vat_percentage} onChangeValue={(n) => updateShippingItem(index, 'vat_percentage', n)} grid />
                          </View>
                          <View style={[styles.calcRow, { borderTopColor: colors.divider }]}>
                            <Text style={[styles.calcTag, { color: colors.textSecondary, backgroundColor: colors.fill }]}>Calculado</Text>
                            <Text style={[styles.calcText, { color: colors.textSecondary }]}>Con IVA <Text style={{ color: colors.text, fontWeight: '600' }}>{formatCurrency(st.valor_con_iva)}</Text></Text>
                          </View>
                        </View>
                      );
                    })}
                    <View style={[styles.fieldRow, { marginTop: 8 }]}>
                      <NumberFormField label="Envío extra (€, importe fijo)" value={formData.shipping_cost} onChangeValue={(n) => setFormData(prev => ({ ...prev, shipping_cost: n }))} half />
                      <View style={{ flex: 1 }} />
                    </View>
                  </FormSection>
                                  <FormSection
                    title="Seguimiento"
                    icon={CalendarClock}
                    subtitle="Opcional · sirve para avisar de pedidos retrasados en el inicio"
                    collapsible
                    startOpen={followList.length > 0}
                    summary={followList.length ? followList.join(' · ') : undefined}
                  >
                    <View style={[styles.fieldRow, { flexWrap: 'wrap' }]}>
                      <DateField
                        label="Fecha prevista"
                        value={formData.expected_date}
                        onChange={d => setFormData(prev => ({ ...prev, expected_date: d }))}
                        tone={expectedLate ? 'danger' : 'normal'}
                        hint={expectedLate ? `Ya ha pasado (${formatISODate(formData.expected_date)}): aparecerá como retrasado.` : undefined}
                      />
                      <View style={{ flex: 1, minWidth: 150 }}>
                        <FormField label="Responsable" value={formData.owner} onChangeText={v => setFormData(prev => ({ ...prev, owner: v }))} placeholder="Quién lo lleva" autoCapitalize="words" />
                      </View>
                    </View>
                    {ownerOptions.length > 0 && (
                      <View style={[styles.chipWrap, { marginTop: -4 }]}>
                        {ownerOptions.slice(0, 6).map(n => (
                          <Pressable
                            key={n}
                            onPress={() => setFormData(prev => ({ ...prev, owner: prev.owner === n ? '' : n }))}
                            style={[styles.chipSmall, { backgroundColor: formData.owner === n ? colors.primarySoftAlt : colors.fill }]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: formData.owner === n }}
                            accessibilityLabel={`Responsable: ${n}`}
                          >
                            <Text style={[styles.chipSmallText, { color: formData.owner === n ? colors.primary : colors.textSecondary }]}>{n}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    <FormField label="Siguiente acción" value={formData.next_action} onChangeText={v => setFormData(prev => ({ ...prev, next_action: v }))} placeholder="Ej.: confirmar fecha de envío con el fabricante" multiline={formData.next_action.length > 50} />
                  </FormSection>
                </View>
                <View style={[styles.formSide, Platform.OS === 'web' && ({ position: 'sticky', top: 12 } as object)]}>
                  {pedidoSection}
                  {resumenCard}
                </View>
              </View>
            ) : (
              <>
                {pedidoSection}
                {clienteSection}
                {productosSection}
                <FormSection
                  title="Envío"
                  icon={Truck}
                  subtitle="«Gastos de envío» son líneas de portes con su IVA. «Envío extra» es un importe fijo que se suma tal cual al total, sin añadirle IVA."
                  action={
                    <Pressable style={[styles.addBtn, { backgroundColor: colors.primarySoft }]} onPress={addShippingItem} accessibilityRole="button" accessibilityLabel="Añadir gasto de envío">
                      <Plus size={14} color={colors.primary} />
                      <Text style={[styles.addBtnText, { color: colors.primary }]}>Añadir gasto</Text>
                    </Pressable>
                  }
                >
                  {formData.shipping_items.length === 0 && <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin gastos de envío</Text>}
                  {formData.shipping_items.map((sh, index) => {
                    const st = calculateShippingTotals(sh);
                    return (
                      <View key={index} style={[styles.itemCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <View style={styles.itemHeader}>
                          <Text style={[styles.itemTitle, { color: colors.textSecondary }]}>Gasto de envío {index + 1}</Text>
                          <Pressable onPress={() => removeShippingItem(index)} hitSlop={8} style={[styles.deleteBtn, { backgroundColor: colors.errorBg }]} accessibilityRole="button" accessibilityLabel={`Quitar gasto de envío ${index + 1}`}>
                            <Trash2 size={14} color={colors.error} />
                          </Pressable>
                        </View>
                        <FormField label="Descripción" value={sh.description} onChangeText={(v) => updateShippingItem(index, 'description', v)} placeholder="Ej.: Transporte urgente" />
                        <View style={styles.fieldGrid}>
                          <NumberFormField label="Cantidad" value={sh.quantity} onChangeValue={(n) => updateShippingItem(index, 'quantity', n)} integer emptyValue={1} grid />
                          <NumberFormField label="Coste unit. (sin IVA)" value={sh.costo_unitario} onChangeValue={(n) => updateShippingItem(index, 'costo_unitario', n)} grid />
                          <NumberFormField label="IVA %" value={sh.vat_percentage} onChangeValue={(n) => updateShippingItem(index, 'vat_percentage', n)} grid />
                        </View>
                        <View style={[styles.calcRow, { borderTopColor: colors.divider }]}>
                          <Text style={[styles.calcTag, { color: colors.textSecondary, backgroundColor: colors.fill }]}>Calculado</Text>
                          <Text style={[styles.calcText, { color: colors.textSecondary }]}>Con IVA <Text style={{ color: colors.text, fontWeight: '600' }}>{formatCurrency(st.valor_con_iva)}</Text></Text>
                        </View>
                      </View>
                    );
                  })}
                  <View style={[styles.fieldRow, { marginTop: 8 }]}>
                    <NumberFormField label="Envío extra (€, importe fijo)" value={formData.shipping_cost} onChangeValue={(n) => setFormData(prev => ({ ...prev, shipping_cost: n }))} half />
                    <View style={{ flex: 1 }} />
                  </View>
                </FormSection>
                <FormSection
                  title="Seguimiento"
                  icon={CalendarClock}
                  subtitle="Opcional · sirve para avisar de pedidos retrasados en el inicio"
                  collapsible
                  startOpen={followList.length > 0}
                  summary={followList.length ? followList.join(' · ') : undefined}
                >
                  <View style={[styles.fieldRow, { flexWrap: 'wrap' }]}>
                    <DateField
                      label="Fecha prevista"
                      value={formData.expected_date}
                      onChange={d => setFormData(prev => ({ ...prev, expected_date: d }))}
                      tone={expectedLate ? 'danger' : 'normal'}
                      hint={expectedLate ? `Ya ha pasado (${formatISODate(formData.expected_date)}): aparecerá como retrasado.` : undefined}
                    />
                    <View style={{ flex: 1, minWidth: 150 }}>
                      <FormField label="Responsable" value={formData.owner} onChangeText={v => setFormData(prev => ({ ...prev, owner: v }))} placeholder="Quién lo lleva" autoCapitalize="words" />
                    </View>
                  </View>
                  {ownerOptions.length > 0 && (
                    <View style={[styles.chipWrap, { marginTop: -4 }]}>
                      {ownerOptions.slice(0, 6).map(n => (
                        <Pressable
                          key={n}
                          onPress={() => setFormData(prev => ({ ...prev, owner: prev.owner === n ? '' : n }))}
                          style={[styles.chipSmall, { backgroundColor: formData.owner === n ? colors.primarySoftAlt : colors.fill }]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: formData.owner === n }}
                          accessibilityLabel={`Responsable: ${n}`}
                        >
                          <Text style={[styles.chipSmallText, { color: formData.owner === n ? colors.primary : colors.textSecondary }]}>{n}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <FormField label="Siguiente acción" value={formData.next_action} onChangeText={v => setFormData(prev => ({ ...prev, next_action: v }))} placeholder="Ej.: confirmar fecha de envío con el fabricante" multiline={formData.next_action.length > 50} />
                </FormSection>
                {documentsSection}
                {resumenCard}
              </>
            );
          })()}
        </ScrollView>
        {!compact && !wideForm && (
        <View style={[styles.saveBar, { borderTopColor: colors.divider, paddingBottom: 10 + insets.bottom, paddingHorizontal: pad }, glass(colors.headerBackground, 24)]}>
          <View style={[styles.saveBarInner, { maxWidth: PAGE_MAX - pad * 2 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {showErrors && errorCount > 0 ? (
                <Text style={[styles.saveBarError, { color: colors.error }]} numberOfLines={2} accessibilityLiveRegion="assertive">
                  {errorCount === 1 ? 'Falta 1 dato obligatorio' : `Faltan ${errorCount} datos obligatorios`}: están marcados en rojo.
                </Text>
              ) : (
                <>
                  {height >= 500 && <Text style={[styles.saveBarLabel, { color: colors.textSecondary }]}>Total con IVA</Text>}
                  <Text style={[styles.saveBarTotal, { color: colors.text }, tiny && { fontSize: 16 }]} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(totals.grandTotal)}</Text>
                </>
              )}
            </View>
            {submitButton}
          </View>
        </View>
        )}
      </KeyboardAvoidingView>
      <SelectSheet
        visible={mfSheetOpen}
        title="Referencia de pedido"
        options={manufacturers.map(m => ({ value: m.id, label: `${m.name} (${m.code})` }))}
        selected={manufacturers[selectedManufacturerIndex]?.id}
        onSelect={id => {
          const i = manufacturers.findIndex(m => m.id === id);
          if (i !== -1) selectManufacturer(i);
        }}
        onClose={() => setMfSheetOpen(false)}
        searchable={manufacturers.length > 5}
        searchPlaceholder="Buscar por nombre o código"
      />
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
  keyboardType?: 'default' | 'numeric' | 'number-pad' | 'decimal-pad' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  testID?: string;
  half?: boolean;
  third?: boolean;
  grid?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  /** Sin etiqueta visible (dentro de una tabla): la etiqueta sigue siendo el nombre accesible */
  bare?: boolean;
  /** Alineación del texto (los importes en tabla van a la derecha) */
  align?: 'left' | 'right' | 'center';
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, multiline, testID, half, third, grid, required, error, hint, onFocus, onBlur, autoCapitalize, autoComplete, bare, align }: FormFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.error : focused ? colors.primary : 'transparent';
  return (
    <View style={[formFieldStyles.container, half && formFieldStyles.halfContainer, third && formFieldStyles.thirdContainer, grid && formFieldStyles.gridContainer, bare && formFieldStyles.bareContainer]}>
      {!bare && (
        <Text style={[formFieldStyles.label, { color: error ? colors.error : colors.textSecondary }]}>
          {label}
          {required ? <Text style={{ color: colors.error }}> *</Text> : null}
        </Text>
      )}
      <TextInput
        style={[formFieldStyles.input, { backgroundColor: colors.fill, borderColor, color: colors.text }, multiline && formFieldStyles.multiline, bare && formFieldStyles.bareInput, align && { textAlign: align }]}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        inputMode={keyboardType === 'decimal-pad' ? 'decimal' : keyboardType === 'number-pad' || keyboardType === 'numeric' ? 'numeric' : keyboardType === 'email-address' ? 'email' : keyboardType === 'phone-pad' ? 'tel' : undefined}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error || hint}
        aria-invalid={!!error}
        aria-required={required}
      />
      {!!error && !bare && <Text style={[formFieldStyles.message, { color: colors.error }]}>{error}</Text>}
      {!error && !!hint && <Text style={[formFieldStyles.message, { color: colors.warning }]}>{hint}</Text>}
    </View>
  );
}

/**
 * Sección agrupada del formulario. Con `collapsible`, en móvil se puede plegar (empieza plegada salvo `startOpen`)
 * y muestra `summary` mientras está cerrada; en tablet y ordenador siempre está abierta.
 */
function FormSection({ title, subtitle, action, children, collapsible, startOpen, summary, icon: Icon, flush }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; collapsible?: boolean; startOpen?: boolean; summary?: string; icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; flush?: boolean }) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const canCollapse = !!collapsible && width < 768;
  const [open, setOpen] = useState(!!startOpen);
  // Al editar, los datos llegan después del primer render: abrir si los hay (salvo que el usuario ya la haya tocado)
  const touched = useRef(false);
  useEffect(() => {
    if (startOpen && !touched.current) setOpen(true);
  }, [startOpen]);
  const isOpen = !canCollapse || open;
  return (
    <View style={formFieldStyles.sectionWrap}>
      <View style={formFieldStyles.sectionHead}>
        {!!Icon && (
          <View style={[formFieldStyles.sectionIcon, { backgroundColor: colors.brand }]}>
            <Icon size={16} color={colors.onPrimary} strokeWidth={2.3} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[formFieldStyles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
            {title}
          </Text>
          {!!subtitle && isOpen && <Text style={[formFieldStyles.sectionSub, { color: colors.textSecondary }]}>{subtitle}</Text>}
        </View>
        {isOpen && action}
      </View>
      <View style={[formFieldStyles.section, { backgroundColor: colors.surface }, cardShadow(isDark), (!isOpen || flush) && { padding: 0, paddingBottom: 0 }]}>
        {canCollapse && (
          <Pressable
            onPress={() => { touched.current = true; setOpen(!open); }}
            style={({ pressed }) => [formFieldStyles.collapseRow, !isOpen && { paddingHorizontal: 16 }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            accessibilityLabel={`${isOpen ? 'Plegar' : 'Desplegar'} ${title.toLowerCase()}`}
            testID={`section-toggle-${title}`}
          >
            <Text style={[formFieldStyles.collapseText, { color: isOpen ? colors.textSecondary : colors.text }]} numberOfLines={1}>
              {isOpen ? 'Plegar' : summary || 'Sin datos · toca para rellenar'}
            </Text>
            {isOpen ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
          </Pressable>
        )}
        {isOpen && children}
      </View>
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
  grid?: boolean;
  required?: boolean;
  error?: string;
  bare?: boolean;
  align?: 'left' | 'right' | 'center';
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

function NumberFormField({ label, value, onChangeValue, integer, emptyValue = 0, half, third, grid, required, error, bare, align }: NumberFormFieldProps) {
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
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      half={half}
      third={third}
      grid={grid}
      required={required}
      error={error}
      placeholder={integer ? undefined : '0,00'}
      bare={bare}
      align={align}
    />
  );
}

const formFieldStyles = StyleSheet.create({
  bareContainer: { marginBottom: 0 },
  bareInput: { paddingVertical: 8, paddingHorizontal: 10, fontSize: 15, minHeight: 40 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  collapseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginBottom: 4 },
  collapseText: { flex: 1, minWidth: 0, fontSize: 16, letterSpacing: -0.2 },
  container: {
    marginBottom: 12,
  },
  gridContainer: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 140,
    marginBottom: 0,
  },
  message: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  sectionWrap: { marginBottom: 24 },
  section: { borderRadius: 14, padding: 16, paddingBottom: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 8, paddingHorizontal: 4, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.4 },
  sectionSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
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
  legend: { fontSize: 13, marginBottom: 12, paddingHorizontal: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chipSmall: { minHeight: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  chipSmallText: { fontSize: 13, fontWeight: '500' as const },
  help: { fontSize: 12, lineHeight: 16 },
  errorText: { fontSize: 12, marginTop: -8, marginBottom: 12 },
  // En móvil la lista va en el flujo (empuja el formulario): flotando quedaba tapada por la barra de guardar
  suggestionsInline: { position: 'relative', top: 0, marginTop: -4, marginBottom: 12 },
  suggestions: { position: 'absolute', top: 72, left: 0, right: 0, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', zIndex: 20, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 28px rgba(0,0,0,0.14)' } as object) : { elevation: 6 }) },
  suggestTitle: { fontSize: 12, fontWeight: '600' as const, textTransform: 'uppercase', letterSpacing: 0.3, paddingHorizontal: 12, paddingVertical: 8 },
  suggestion: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 48 },
  suggestName: { fontSize: 15, fontWeight: '500' as const },
  note: { fontSize: 13, lineHeight: 18, padding: 10, borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  itemTitle: { fontSize: 13, fontWeight: '600' as const, textTransform: 'uppercase', letterSpacing: 0.3 },
  calcTag: { fontSize: 11, fontWeight: '600' as const, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', textTransform: 'uppercase', letterSpacing: 0.3 },
  saveBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 16 },
  saveBarInner: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', alignSelf: 'center' },
  saveBarLabel: { fontSize: 12 },
  saveBarTotal: { fontSize: 20, fontWeight: '700' as const, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  saveBarError: { fontSize: 14, fontWeight: '600' as const },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: StaticColors.accent,
    borderRadius: 999,
  },
  saveBtnText: { color: StaticColors.white, fontWeight: '600' as const, fontSize: 15,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  refField: { flexGrow: 1, flexBasis: 170, minWidth: 170, marginBottom: 12 },
  yearField: { flexBasis: 84, flexGrow: 1, minWidth: 84, maxWidth: 160, flexDirection: 'row' },
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
    flexWrap: 'wrap',
    gap: 12,
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
  topBar: { zIndex: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  topBarInner: { width: '100%', alignSelf: 'center', height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topBtn: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 10 },
  topBtnText: { fontSize: 17, letterSpacing: -0.3 },
  topTitleWrap: { position: 'absolute', left: 110, right: 110, alignItems: 'center' },
  topTitleText: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.3, textAlign: 'center' },
  topTotal: { fontSize: 12.5, fontVariant: ['tabular-nums'], marginTop: -1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnCompact: { minHeight: 36, paddingHorizontal: 16 },
  scanPill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, minWidth: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999 },
  scanPillText: { fontSize: 15, fontWeight: '600' as const, letterSpacing: -0.2 },
  submitBtn: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 999,
    minHeight: 48,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: StaticColors.white, fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2,
  },
  selectField: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, marginBottom: 14 },
  selectText: { flex: 1, minWidth: 0, fontSize: 16, letterSpacing: -0.2 },
  formCols: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  formMain: { flex: 1.9, minWidth: 0 },
  formSide: { flex: 1, minWidth: 320, maxWidth: 440 },
  totalsHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 },
  tRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  tHead: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'flex-end' },
  tTh: { fontSize: 12, fontWeight: '600' as const },
  tQty: { width: 64 },
  tName: { flex: 1, minWidth: 180 },
  tMoney: { width: 104, textAlign: 'right' },
  tPct: { width: 64, textAlign: 'right' },
  tCalc: { width: 132, alignItems: 'flex-end', paddingTop: 2 },
  tCalcMain: { fontSize: 15, fontWeight: '700' as const, fontVariant: ['tabular-nums'] },
  tCalcSub: { fontSize: 12, fontVariant: ['tabular-nums'] },
  tDel: { width: 36, alignItems: 'center' },
  tDelBtn: { width: 36, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tErr: { fontSize: 12, marginTop: 2 },
});
