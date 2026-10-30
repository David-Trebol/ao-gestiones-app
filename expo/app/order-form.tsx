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
import * as ImagePicker from 'expo-image-picker';
import { supabase, describeError } from '@/lib/supabase';
import { webInputReset } from '@/constants/theme';
import { z } from 'zod';

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

const extractionSchema = z.object({
  nombre_empresa: z.string().describe("Nombre de la empresa cliente").optional(),
  contacto: z.string().describe("Nombre de la persona de contacto").optional(),
  departamento: z.string().describe("Departamento del contacto").optional(),
  numero_referencia_pedido: z.string().describe("Número de referencia del pedido del cliente").optional(),
  direccion_1: z.string().describe("Dirección línea 1").optional(),
  direccion_2: z.string().describe("Dirección línea 2").optional(),
  codigo_postal: z.string().describe("Código postal").optional(),
  provincia: z.string().describe("Provincia o comunidad autónoma").optional(),
  pais: z.string().describe("País, por defecto España").optional(),
  telefono_1: z.string().describe("Teléfono principal").optional(),
  telefono_2: z.string().describe("Teléfono secundario").optional(),
  email: z.string().describe("Dirección de email").optional(),
  nif: z.string().describe("NIF o CIF de la empresa").optional(),
  oferta_proforma: z.string().describe("Número de oferta o proforma").optional(),
  condiciones_entrega: z.string().describe("Condiciones de entrega acordadas").optional(),
  condiciones_pago: z.string().describe("Condiciones de pago acordadas").optional(),
  numero_factura: z.string().describe("Número de factura si aparece").optional(),
  numero_recibo: z.string().describe("Número de recibo o albarán si aparece").optional(),
  custom_reference: z.string().describe("Referencia personalizada del pedido").optional(),
  items: z.array(z.object({
    product_name: z.string().describe("Nombre o descripción del producto/artículo"),
    quantity: z.number().describe("Cantidad pedida").optional(),
    costo_unitario: z.number().describe("Precio de coste unitario").optional(),
    tpv_unitario: z.number().describe("Precio de venta unitario (PVP)").optional(),
    total_sin_iva: z.number().describe("Total sin IVA de esta línea").optional(),
    descuento_porcentaje: z.number().describe("Porcentaje de descuento aplicado").optional(),
    vat_percentage: z.number().describe("Porcentaje de IVA, normalmente 21").optional(),
  })).describe("Lista de productos/artículos encontrados en el documento").optional(),
  shipping_items: z.array(z.object({
    description: z.string().describe("Descripción del servicio de envío o transporte"),
    quantity: z.number().describe("Cantidad").optional(),
    costo_unitario: z.number().describe("Coste unitario del envío").optional(),
    vat_percentage: z.number().describe("Porcentaje de IVA del envío").optional(),
  })).describe("Gastos de envío o transporte si se encuentran").optional(),
});

type ExtractionResult = z.infer<typeof extractionSchema>;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('FileReader falló'));
    reader.readAsDataURL(blob);
  });
}

async function readFileAsBase64(uri: string, _mimeType: string): Promise<string> {
  console.log('[FileRead] Platform:', Platform.OS, 'URI:', uri.substring(0, 120));

  try {
    console.log('[FileRead] Trying fetch approach...');
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }
    const blob = await response.blob();
    console.log('[FileRead] Blob size:', blob.size, 'type:', blob.type);
    if (blob.size === 0) {
      throw new Error('Blob vacío');
    }
    const base64 = await blobToBase64(blob);
    console.log('[FileRead] fetch+blob base64 length:', base64.length);
    return base64;
  } catch (fetchErr: any) {
    console.log('[FileRead] Fetch approach failed:', fetchErr?.message);
  }

  if (Platform.OS !== 'web') {
    try {
      console.log('[FileRead] Trying expo-file-system legacy...');
      const LegacyFS = await import('expo-file-system/legacy');
      const base64 = await LegacyFS.readAsStringAsync(uri, {
        encoding: (LegacyFS as any).EncodingType?.Base64 ?? 'base64',
      });
      console.log('[FileRead] Legacy base64 length:', base64.length);
      return base64;
    } catch (legacyErr: any) {
      console.log('[FileRead] Legacy failed:', legacyErr?.message);
    }

    try {
      console.log('[FileRead] Trying expo-file-system File class...');
      const FS = await import('expo-file-system');
      const ExpoFile = (FS as any).File || (FS as any).default?.File;
      if (ExpoFile) {
        const file = new ExpoFile(uri);
        const base64 = await file.base64();
        console.log('[FileRead] File class base64 length:', base64.length);
        return base64;
      }
      throw new Error('File class not found in expo-file-system');
    } catch (fileErr: any) {
      console.log('[FileRead] File class failed:', fileErr?.message);
    }
  }

  throw new Error('No se pudo leer el archivo. Intenta con una imagen diferente.');
}

/**
 * Envía el documento a la función segura "extract-order" de Supabase, que usa IA para leerlo.
 * La clave de la IA vive en el servidor (nunca en la app).
 */
async function extractDataFromDocument(
  base64: string,
  mimeType: string,
): Promise<ExtractionResult> {
  const effectiveMime = mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg');
  const { data, error } = await supabase.functions.invoke('extract-order', {
    body: { base64, mimeType: effectiveMime },
  });
  if (error) {
    let message = describeError(error);
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        if (body?.error) message = body.error;
      }
    } catch {
      // mensaje genérico
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  const parsed = extractionSchema.safeParse(data?.result ?? {});
  if (!parsed.success) throw new Error('La IA devolvió datos con un formato inesperado. Inténtalo de nuevo.');
  return parsed.data;
}

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
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [extractionFileName, setExtractionFileName] = useState<string>('');
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const extractionAbortRef = useRef<boolean>(false);

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

  const applyExtractedData = useCallback((data: ExtractionResult) => {
    console.log('[Apply] AI extracted data:', JSON.stringify(data, null, 2));

    setFormData(prev => {
      const updated = { ...prev };

      const customerKeys: (keyof Customer)[] = [
        'nombre_empresa', 'contacto', 'departamento', 'numero_referencia_pedido',
        'direccion_1', 'direccion_2', 'codigo_postal', 'provincia', 'pais',
        'telefono_1', 'telefono_2', 'email', 'nif', 'oferta_proforma',
        'condiciones_entrega', 'condiciones_pago', 'numero_factura', 'numero_recibo',
      ];

      const newCustomer = { ...prev.customer };
      for (const key of customerKeys) {
        const val = (data as Record<string, unknown>)[key];
        if (val && typeof val === 'string' && val.trim()) {
          (newCustomer as Record<string, string>)[key] = val;
        }
      }
      updated.customer = newCustomer;

      if (data.custom_reference) {
        updated.custom_reference = data.custom_reference;
      }

      if (data.items && data.items.length > 0) {
        updated.items = data.items.map(item => ({
          product_name: item.product_name || '',
          quantity: item.quantity ?? 1,
          costo_unitario: item.costo_unitario ?? 0,
          tpv_unitario: item.tpv_unitario ?? 0,
          total_sin_iva: item.total_sin_iva ?? 0,
          descuento_porcentaje: item.descuento_porcentaje ?? 0,
          vat_percentage: item.vat_percentage ?? 21,
        }));
      }

      if (data.shipping_items && data.shipping_items.length > 0) {
        updated.shipping_items = data.shipping_items.map(s => ({
          description: s.description || '',
          quantity: s.quantity ?? 1,
          costo_unitario: s.costo_unitario ?? 0,
          total_sin_iva: 0,
          vat_percentage: s.vat_percentage ?? 21,
        }));
      }

      return updated;
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Datos extraídos', 'Se han rellenado los campos con la información del documento. Revisa y ajusta los datos antes de guardar.');
  }, []);

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

  const processFile = useCallback(async (uri: string, mimeType: string, fileName: string) => {
    extractionAbortRef.current = false;
    setIsExtracting(true);
    setExtractionFileName(fileName);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log('[Process] Reading file:', fileName, 'mimeType:', mimeType);
      const base64 = await readFileAsBase64(uri, mimeType);
      console.log('[Process] File read OK, base64 length:', base64.length);

      if (extractionAbortRef.current) {
        console.log('[Process] Cancelled after file read');
        return;
      }

      const extractedData = await extractDataFromDocument(base64, mimeType);
      console.log('[Process] Extraction result:', JSON.stringify(extractedData, null, 2));

      if (extractionAbortRef.current) {
        console.log('[Process] Cancelled after AI response');
        return;
      }

      applyExtractedData(extractedData);
    } catch (extractErr: any) {
      console.error('[Process] Extraction failed:', extractErr);
      if (!extractionAbortRef.current) {
        Alert.alert(
          'Error de extracción',
          `No se pudieron extraer los datos: ${extractErr?.message || 'Error desconocido'}. Intenta con una imagen o rellena manualmente.`
        );
      }
    } finally {
      setIsExtracting(false);
      setExtractionFileName('');
    }
  }, [applyExtractedData]);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || 'imagen_galeria';
      console.log('[ImagePick] Image selected, mimeType:', mimeType, 'hasBase64:', !!asset.base64);

      if (asset.base64) {
        extractionAbortRef.current = false;
        setIsExtracting(true);
        setExtractionFileName(fileName);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
          const extractedData = await extractDataFromDocument(asset.base64, mimeType);
          if (!extractionAbortRef.current) {
            applyExtractedData(extractedData);
          }
        } catch (extractErr: any) {
          console.error('[ImagePick] Extraction failed:', extractErr);
          if (!extractionAbortRef.current) {
            Alert.alert('Error de extracción', `No se pudieron extraer los datos: ${extractErr?.message || 'Error desconocido'}`);
          }
        } finally {
          setIsExtracting(false);
          setExtractionFileName('');
        }
      } else {
        await processFile(asset.uri, mimeType, fileName);
      }
    } catch (err) {
      console.error('[ImagePick] Error:', err);
      setIsExtracting(false);
      setExtractionFileName('');
      Alert.alert('Error', 'No se pudo abrir la galería de imágenes');
    }
  }, [processFile, applyExtractedData]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/jpeg',
          'image/png',
          'image/jpg',
          'image/webp',
          'application/pdf',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'application/octet-stream';
      console.log('[Pick] Document:', asset.name, mimeType, 'uri:', asset.uri?.substring(0, 100));

      await processFile(asset.uri, mimeType, asset.name || 'documento');
    } catch (err) {
      console.error('[Pick] Document pick error:', err);
      setIsExtracting(false);
      setExtractionFileName('');
      Alert.alert('Error', 'No se pudo abrir el selector de documentos');
    }
  }, [processFile]);

  const handleTakePhoto = useCallback(async () => {
    try {
      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permiso necesario', 'Se necesita acceso a la cámara para tomar fotos de documentos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      console.log('[Camera] Photo taken, mimeType:', mimeType);

      if (asset.base64) {
        extractionAbortRef.current = false;
        setIsExtracting(true);
        setExtractionFileName('foto_documento');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
          const extractedData = await extractDataFromDocument(asset.base64, mimeType);
          if (!extractionAbortRef.current) {
            applyExtractedData(extractedData);
          }
        } catch (extractErr: any) {
          console.error('[Camera] Extraction failed:', extractErr);
          if (!extractionAbortRef.current) {
            Alert.alert('Error de extracción', `No se pudieron extraer los datos: ${extractErr?.message || 'Error desconocido'}`);
          }
        } finally {
          setIsExtracting(false);
          setExtractionFileName('');
        }
      } else {
        await processFile(asset.uri, mimeType, 'foto_documento');
      }
    } catch (err) {
      console.error('[Camera] Error:', err);
      setIsExtracting(false);
      setExtractionFileName('');
      Alert.alert('Error', 'No se pudo acceder a la cámara');
    }
  }, [processFile, applyExtractedData]);

  const handleScanAction = useCallback(() => {
    Alert.alert(
      'Escanear Documento',
      'Elige cómo quieres importar el documento:',
      [
        { text: 'Imagen de Galería', onPress: handlePickImage },
        { text: 'Archivo (PDF, Imagen)', onPress: handlePickDocument },
        ...(Platform.OS !== 'web' ? [{ text: 'Tomar Foto', onPress: handleTakePhoto }] : []),
        { text: 'Cancelar', style: 'cancel' as const },
      ]
    );
  }, [handlePickImage, handlePickDocument, handleTakePhoto]);

  const cancelExtraction = useCallback(() => {
    extractionAbortRef.current = true;
    setIsExtracting(false);
    setExtractionFileName('');
  }, []);

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
          {isExtracting ? (
            <View style={[styles.extractingBanner, { backgroundColor: isDark ? colors.surface : colors.primaryDark }]}>
              <View style={styles.extractingContent}>
                <Animated.View style={[styles.extractingIconWrap, { opacity: pulseAnim }]}>
                  <ScanLine size={22} color="#FFFFFF" />
                </Animated.View>
                <View style={styles.extractingTextWrap}>
                  <Text style={styles.extractingTitle}>Analizando documento...</Text>
                  <Text style={styles.extractingSubtitle} numberOfLines={1}>{extractionFileName}</Text>
                </View>
                <Pressable onPress={cancelExtraction} hitSlop={10} style={styles.extractingCancel}>
                  <X size={18} color="rgba(255,255,255,0.7)" />
                </Pressable>
              </View>
              <View style={styles.extractingProgress}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.extractingProgressText}>Extrayendo datos con IA...</Text>
              </View>
            </View>
          ) : (
            <Pressable
              style={[styles.scanBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
              onPress={handleScanAction}
              testID="scan-document-btn"
            >
              <View style={[styles.scanBtnIconWrap, { backgroundColor: colors.primary }]}>
                <ScanLine size={18} color="#FFFFFF" />
              </View>
              <View style={styles.scanBtnTextWrap}>
                <Text style={[styles.scanBtnTitle, { color: colors.text }]}>Escanear Documento</Text>
                <Text style={[styles.scanBtnSubtitle, { color: colors.textSecondary }]}>PDF, JPG, PNG — Extracción con IA</Text>
              </View>
              <FileText size={16} color={colors.primaryLight} />
            </Pressable>
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
  extractingCancel: {
    padding: 6,
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
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500' as const,
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
