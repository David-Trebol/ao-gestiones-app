import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { NATIVE_DRIVER } from '@/constants/animation';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  useWindowDimensions,
  TextInput,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  MapPin,
  Phone,
  Package,
  Euro,
  Building2,
  Mail,
  FileText,
  Truck,
  Edit3,
  Trash2,
  Check,
  X,
  Pencil,
  Calendar,
  Clock,
  Hash,
  Tag,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDateLong } from '@/utils/calculations';
import * as Haptics from 'expo-haptics';

function AnimatedSection({ children, index }: { children: React.ReactNode; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(50)).current;
  const scaleVal = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const delay = Math.min(index * 120, 600);
    Animated.parallel([
      Animated.spring(anim, { toValue: 1, friction: 5, tension: 40, delay, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(slideY, { toValue: 0, friction: 5, tension: 40, delay, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(scaleVal, { toValue: 1, friction: 4, tension: 50, delay, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- los valores animados son refs estables
  }, [index]);

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: slideY }, { scale: scaleVal }] }}>
      {children}
    </Animated.View>
  );
}

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { orders, deleteOrder, updateOrderField, duplicateOrder } = useData();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 880 : width;

  const order = useMemo(() => orders.find(o => o.id === orderId), [orders, orderId]);
  const shippingGrandTotal = useMemo(() => {
    if (!order) return 0;
    const items = (order.shipping_items ?? []).reduce((sum, s) => sum + (s.valor_con_iva || 0), 0);
    return Math.round((items + (order.shipping_cost || 0)) * 100) / 100;
  }, [order]);

  const [isEditingRef, setIsEditingRef] = useState<boolean>(false);
  const [editRefValue, setEditRefValue] = useState<string>('');
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const editPulse = useRef(new Animated.Value(1)).current;

  const toggleItemExpand = useCallback((index: number) => {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const splitProductName = useCallback((fullName: string) => {
    const dashIndex = fullName.indexOf(' - ');
    if (dashIndex === -1) {
      return { name: fullName, description: '' };
    }
    const firstPart = fullName.substring(0, dashIndex).trim();
    const restPart = fullName.substring(dashIndex + 3).trim();
    if (firstPart.length <= 40) {
      return { name: firstPart, description: restPart };
    }
    return { name: fullName, description: '' };
  }, []);

  const handleStartEditRef = useCallback(() => {
    if (!order) return;
    setEditRefValue(order.custom_reference || '');
    setIsEditingRef(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(editPulse, { toValue: 1.04, duration: 150, easing: Easing.out(Easing.back(2)), useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(editPulse, { toValue: 1, friction: 4, tension: 80, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [order, editPulse]);

  const handleSaveRef = useCallback(async () => {
    if (!order) return;
    try {
      await updateOrderField(order.id, 'custom_reference', editRefValue.trim());
      setIsEditingRef(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    }
  }, [order, editRefValue, updateOrderField]);

  const handleCancelEditRef = useCallback(() => {
    setIsEditingRef(false);
    setEditRefValue('');
  }, []);

  const handleDelete = useCallback(() => {
    if (!order) return;
    Alert.alert(
      '¿Estás seguro?',
      `Se eliminará permanentemente el pedido ${order.reference_number}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrder(order.id);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              if (router.canGoBack()) router.back();
              else router.replace('/');
            } catch (e) {
              Alert.alert('No se pudo eliminar', (e as Error).message);
            }
          },
        },
      ]
    );
  }, [order, deleteOrder, router]);

  const handleEdit = useCallback(() => {
    if (!order) return;
    router.push(`/order-form?editOrderId=${order.id}` as any);
  }, [order, router]);

  const handleDuplicate = useCallback(() => {
    if (!order) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Duplicar pedido',
      `¿Duplicar "${order.reference_number}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Duplicar',
          onPress: async () => {
            try {
              const newOrder = await duplicateOrder(order.id);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Pedido duplicado', `Se creó "${newOrder.reference_number}" como pedido pendiente.`, [
                { text: 'Seguir aquí', style: 'cancel' },
                { text: 'Abrir copia', onPress: () => router.replace(`/order-detail?orderId=${newOrder.id}` as any) },
              ]);
            } catch (e) {
              Alert.alert('No se pudo duplicar', (e as Error).message);
            }
          },
        },
      ]
    );
  }, [order, duplicateOrder, router]);

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.notFoundWrap}>
          <Text style={[styles.notFound, { color: colors.textSecondary }]}>Pedido no encontrado</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: order.reference_number,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={handleDuplicate} style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]} hitSlop={8}>
                <Copy size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={handleEdit} style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]} hitSlop={8}>
                <Edit3 size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={handleDelete} style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]} hitSlop={8}>
                <Trash2 size={20} color="#FFB4B4" />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as any },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedSection index={0}>
          <Animated.View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow, transform: [{ scale: editPulse }] }]}>
            <View style={styles.heroTop}>
              <View style={styles.heroRefSection}>
                <View style={styles.heroRefLabelRow}>
                  <Hash size={12} color={colors.primaryLight} />
                  <Text style={[styles.heroRefLabel, { color: colors.primaryLight }]}>REFERENCIA</Text>
                </View>
                <Text style={[styles.heroRefNumber, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{order.reference_number}</Text>
              </View>
              <StatusBadge status={order.status} />
            </View>

            <View style={[styles.heroDivider, { backgroundColor: colors.divider }]} />

            <View style={styles.heroCustomRefSection}>
              <View style={styles.heroCustomRefLeft}>
                <View style={styles.heroCustomRefLabelRow}>
                  <Tag size={12} color={isEditingRef ? colors.accent : colors.textSecondary} />
                  <Text style={[styles.heroCustomRefLabel, { color: isEditingRef ? colors.accent : colors.textSecondary }]}>
                    REF. MANUAL
                  </Text>
                </View>

                {isEditingRef ? (
                  <View style={styles.editRefRow}>
                    <TextInput
                      style={[styles.editRefInput, { backgroundColor: colors.background, borderColor: colors.accent, color: colors.text }]}
                      value={editRefValue}
                      onChangeText={setEditRefValue}
                      placeholder="Escribe la referencia..."
                      placeholderTextColor={colors.textTertiary}
                      autoFocus
                      onSubmitEditing={handleSaveRef}
                      returnKeyType="done"
                    />
                    <Pressable onPress={handleSaveRef} style={({ pressed }) => [styles.editRefBtn, { backgroundColor: colors.surfaceAlt, transform: [{ scale: pressed ? 0.85 : 1 }] }]} hitSlop={6}>
                      <Check size={16} color={colors.success} />
                    </Pressable>
                    <Pressable onPress={handleCancelEditRef} style={({ pressed }) => [styles.editRefBtn, { backgroundColor: colors.surfaceAlt, transform: [{ scale: pressed ? 0.85 : 1 }] }]} hitSlop={6}>
                      <X size={16} color={colors.error} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={handleStartEditRef} style={({ pressed }) => [styles.customRefTappable, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                    <Text style={[styles.heroCustomRefValue, { color: colors.text }]}>
                      {order.custom_reference || 'Sin referencia manual'}
                    </Text>
                    <View style={[styles.editRefIconWrap, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.08)' }]}>
                      <Pencil size={12} color={colors.primary} />
                    </View>
                  </Pressable>
                )}
              </View>
            </View>
          </Animated.View>
        </AnimatedSection>

        <AnimatedSection index={1}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
            <View style={styles.sectionTitle}>
              <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                <Building2 size={16} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitleText, { color: colors.text }]}>Cliente</Text>
            </View>

            <View style={styles.customerInfo}>
              <View style={[styles.customerField, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Empresa</Text>
                <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.nombre_empresa}</Text>
              </View>

              {order.customer.contacto ? (
                <View style={[styles.customerField, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Contacto</Text>
                  <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.contacto}</Text>
                  {order.customer.departamento ? (
                    <Text style={[styles.customerSubvalue, { color: colors.textSecondary }]}>{order.customer.departamento}</Text>
                  ) : null}
                </View>
              ) : null}

              {order.customer.numero_referencia_pedido ? (
                <View style={[styles.customerField, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Ref. Pedido Cliente</Text>
                  <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.numero_referencia_pedido}</Text>
                </View>
              ) : null}

              <View style={[styles.customerFieldWithIcon, { borderBottomColor: colors.divider }]}>
                <View style={[styles.fieldIconWrap, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                  <MapPin size={14} color={colors.primary} />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Dirección</Text>
                  <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.direccion_1}</Text>
                  {order.customer.direccion_2 ? <Text style={[styles.customerSubvalue, { color: colors.textSecondary }]}>{order.customer.direccion_2}</Text> : null}
                  <Text style={[styles.customerSubvalue, { color: colors.textSecondary }]}>
                    {order.customer.codigo_postal} {order.customer.provincia}
                  </Text>
                  <Text style={[styles.customerSubvalue, { color: colors.textSecondary }]}>{order.customer.pais}</Text>
                </View>
              </View>

              <View style={[styles.contactRow, { borderBottomColor: colors.divider }]}>
                <View style={styles.contactItem}>
                  <View style={[styles.fieldIconWrapSmall, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                    <Phone size={12} color={colors.primary} />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Teléfonos</Text>
                    <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.telefono_1}</Text>
                    {order.customer.telefono_2 ? <Text style={[styles.customerSubvalue, { color: colors.textSecondary }]}>{order.customer.telefono_2}</Text> : null}
                  </View>
                </View>
                <View style={styles.contactItem}>
                  <View style={[styles.fieldIconWrapSmall, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                    <Mail size={12} color={colors.primary} />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
                    <Text style={[styles.customerValue, { color: colors.text }]} numberOfLines={1}>{order.customer.email}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.customerField, { borderBottomWidth: 0 }]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>NIF</Text>
                <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.nif}</Text>
              </View>
            </View>
          </View>
        </AnimatedSection>

        <AnimatedSection index={2}>
          <View style={[styles.totalsCard, { backgroundColor: isDark ? colors.surface : colors.primaryDark, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}>
            <View style={styles.totalsHeader}>
              <View style={styles.totalsIconWrap}>
                <Euro size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.totalsHeaderText}>Resumen Financiero</Text>
            </View>

            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <Text style={styles.totalItemLabel}>Subtotal</Text>
                <Text style={styles.totalItemValue}>{formatCurrency(order.total_ex_vat)}</Text>
                <Text style={styles.totalItemSub}>sin IVA</Text>
              </View>
              <View style={styles.totalsDividerV} />
              <View style={styles.totalItem}>
                <Text style={styles.totalItemLabel}>IVA</Text>
                <Text style={styles.totalItemValue}>{formatCurrency(order.total_vat)}</Text>
                <Text style={styles.totalItemSub}>impuestos</Text>
              </View>
              {shippingGrandTotal > 0 && (
                <>
                  <View style={styles.totalsDividerV} />
                  <View style={styles.totalItem}>
                    <Text style={styles.totalItemLabel}>Envío</Text>
                    <Text style={styles.totalItemValue}>{formatCurrency(shippingGrandTotal)}</Text>
                    <Text style={styles.totalItemSub}>con IVA</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(order.total_with_vat)}</Text>
            </View>
          </View>
        </AnimatedSection>

        {order.shipping_items && order.shipping_items.length > 0 && (
          <AnimatedSection index={3}>
            <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#FFFDF7', borderColor: isDark ? colors.border : colors.warningBorder }]}>
              <View style={styles.sectionTitle}>
                <View style={[styles.sectionIconWrap, { backgroundColor: colors.warningBg }]}>
                  <Truck size={16} color={colors.warning} />
                </View>
                <Text style={[styles.sectionTitleText, { color: colors.text }]}>Gastos de Envío</Text>
                <View style={[styles.sectionBadge, { backgroundColor: colors.warningBg }]}>
                  <Text style={[styles.sectionBadgeText, { color: colors.warning }]}>{order.shipping_items.length}</Text>
                </View>
              </View>

              {order.shipping_items.map((shipping, index) => (
                <View key={index} style={[styles.productItem, { backgroundColor: isDark ? colors.surfaceAlt : '#FFFFFF', borderColor: isDark ? colors.border : colors.warningBorder }, index < order.shipping_items.length - 1 && { marginBottom: 12 }]}>
                  <View style={styles.productHeader}>
                    <View style={styles.productHeaderLeft}>
                      <View style={[styles.productIndexBadge, { backgroundColor: colors.warningBg }]}>
                        <Text style={[styles.productIndexText, { color: colors.warning }]}>{index + 1}</Text>
                      </View>
                      <View style={styles.productNameWrap}>
                        <Text style={[styles.productName, { color: colors.text }]}>{shipping.description || 'Envío'}</Text>
                        <Text style={[styles.productQty, { color: colors.textSecondary }]}>× {shipping.quantity} uds.</Text>
                      </View>
                    </View>
                    <View style={styles.productPriceWrap}>
                      <Text style={[styles.productTotal, { color: colors.text }]}>{formatCurrency(shipping.valor_con_iva)}</Text>
                      <Text style={[styles.productTotalLabel, { color: colors.textTertiary }]}>con IVA</Text>
                    </View>
                  </View>
                  <View style={[styles.productGrid, { borderTopColor: colors.borderLight }]}>
                    <View style={styles.productGridItem}>
                      <Text style={[styles.gridLabel, { color: colors.textTertiary }]}>Costo</Text>
                      <Text style={[styles.gridValue, { color: colors.text }]}>{formatCurrency(shipping.costo_unitario)}</Text>
                    </View>
                    <View style={styles.productGridItem}>
                      <Text style={[styles.gridLabel, { color: colors.warning }]}>Total s/IVA</Text>
                      <Text style={[styles.gridValue, { color: colors.warning }]}>{formatCurrency(shipping.valor_sin_iva)}</Text>
                    </View>
                    <View style={styles.productGridItem}>
                      <Text style={[styles.gridLabel, { color: colors.textTertiary }]}>IVA</Text>
                      <Text style={[styles.gridValue, { color: colors.text }]}>{shipping.vat_percentage}%</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </AnimatedSection>
        )}

        <AnimatedSection index={4}>
          <View style={styles.metaRow}>
            <View style={[styles.metaItem, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={[styles.metaIconWrap, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                <Building2 size={14} color={colors.primary} />
              </View>
              <View style={styles.metaTextWrap}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Fabricante</Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>{order.manufacturer_name}</Text>
                <Text style={[styles.metaCode, { color: colors.textTertiary }]}>{order.manufacturer_code}</Text>
              </View>
            </View>
            <View style={[styles.metaItem, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={[styles.metaIconWrap, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                <Calendar size={14} color={colors.primary} />
              </View>
              <View style={styles.metaTextWrap}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Año</Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>{order.year}</Text>
              </View>
            </View>
          </View>
        </AnimatedSection>

        <AnimatedSection index={5}>
          <View style={styles.metaRow}>
            <View style={[styles.metaItem, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={[styles.metaIconWrap, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                <Clock size={14} color={colors.textSecondary} />
              </View>
              <View style={styles.metaTextWrap}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Creado</Text>
                <Text style={[styles.metaValueSmall, { color: colors.text }]}>{formatDateLong(order.created_at)}</Text>
              </View>
            </View>
            <View style={[styles.metaItem, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={[styles.metaIconWrap, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                <Clock size={14} color={colors.textSecondary} />
              </View>
              <View style={styles.metaTextWrap}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Actualizado</Text>
                <Text style={[styles.metaValueSmall, { color: colors.text }]}>{formatDateLong(order.updated_at)}</Text>
              </View>
            </View>
          </View>
        </AnimatedSection>

        <AnimatedSection index={6}>
          <View style={isDesktop ? styles.desktopRow : undefined}>
            <View style={isDesktop ? styles.desktopMain : undefined}>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
                <View style={styles.sectionTitle}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                    <Package size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitleText, { color: colors.text }]}>Productos</Text>
                  <View style={[styles.sectionBadge, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.08)' }]}>
                    <Text style={[styles.sectionBadgeText, { color: colors.primary }]}>{order.items.length}</Text>
                  </View>
                </View>

                {order.items.map((item, index) => {
                  const { name: productTitle, description: productDesc } = splitProductName(item.product_name);
                  const isExpanded = expandedItems[index] ?? false;
                  return (
                    <ProductItemAnimated key={index} index={index}>
                      <View style={[styles.productItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]}>
                        <View style={styles.productHeader}>
                          <View style={styles.productHeaderLeft}>
                            <View style={[styles.productIndexBadge, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.08)' }]}>
                              <Text style={[styles.productIndexText, { color: colors.primary }]}>{index + 1}</Text>
                            </View>
                            <View style={styles.productNameWrap}>
                              <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>{productTitle}</Text>
                              <Text style={[styles.productQty, { color: colors.textSecondary }]}>× {item.quantity} uds.</Text>
                            </View>
                          </View>
                          <View style={styles.productPriceWrap}>
                            <Text style={[styles.productTotal, { color: colors.text }]}>{formatCurrency(item.valor_con_iva)}</Text>
                            <Text style={[styles.productTotalLabel, { color: colors.textTertiary }]}>con IVA</Text>
                          </View>
                        </View>

                        <View style={styles.descriptionSection}>
                          <Pressable
                            onPress={() => toggleItemExpand(index)}
                            style={({ pressed }) => [styles.descriptionToggle, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.04)' : 'rgba(27, 107, 90, 0.04)', borderColor: colors.borderLight, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                            hitSlop={4}
                          >
                            <FileText size={13} color={colors.textSecondary} />
                            <Text style={[styles.descriptionToggleText, { color: colors.textSecondary }]}>
                              {isExpanded ? 'Ocultar descripción' : 'Ver descripción'}
                            </Text>
                            {isExpanded ? (
                              <ChevronUp size={14} color={colors.textSecondary} />
                            ) : (
                              <ChevronDown size={14} color={colors.textSecondary} />
                            )}
                          </Pressable>
                          {isExpanded && (
                            <View style={[styles.descriptionContent, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                                {productDesc.length > 0 ? productDesc : item.product_name}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={[styles.productGrid, { borderTopColor: colors.borderLight }]}>
                          <View style={styles.productGridItem}>
                            <Text style={[styles.gridLabel, { color: colors.textTertiary }]}>Costo Unit.</Text>
                            <Text style={[styles.gridValue, { color: colors.text }]}>{formatCurrency(item.costo_unitario)}</Text>
                          </View>
                          <View style={styles.productGridItem}>
                            <Text style={[styles.gridLabel, { color: colors.textTertiary }]}>Descuento</Text>
                            <Text style={[styles.gridValue, { color: colors.text }]}>{item.descuento_porcentaje}%</Text>
                          </View>
                          {item.total_sin_iva > 0 && (
                            <View style={styles.productGridItem}>
                              <Text style={[styles.gridLabel, { color: colors.primary }]}>Total s/IVA</Text>
                              <Text style={[styles.gridValue, { color: colors.primary }]}>{formatCurrency(item.total_sin_iva)}</Text>
                            </View>
                          )}
                          <View style={styles.productGridItem}>
                            <Text style={[styles.gridLabel, { color: colors.textTertiary }]}>IVA</Text>
                            <Text style={[styles.gridValue, { color: colors.text }]}>{item.vat_percentage}%</Text>
                          </View>
                          <View style={[styles.productGridItem, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.04)' : 'rgba(27, 107, 90, 0.04)', borderRadius: 8 }]}>
                            <Text style={[styles.gridLabel, { color: colors.textTertiary }]}>Beneficio línea</Text>
                            <Text style={[styles.gridValue, { color: item.beneficio_bruto >= 0 ? colors.success : colors.error }]}>
                              {formatCurrency(item.beneficio_bruto)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </ProductItemAnimated>
                  );
                })}
              </View>
            </View>

            {isDesktop && (
              <View style={styles.desktopSide}>
                {(order.customer.oferta_proforma || order.customer.condiciones_entrega || order.customer.condiciones_pago || order.customer.numero_factura || order.customer.numero_recibo) && (
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
                    <View style={styles.sectionTitle}>
                      <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                        <FileText size={16} color={colors.primary} />
                      </View>
                      <Text style={[styles.sectionTitleText, { color: colors.text }]}>Info. Adicional</Text>
                    </View>

                    <View style={styles.additionalGrid}>
                      {order.customer.oferta_proforma ? (
                        <View style={[styles.additionalItem, { backgroundColor: colors.surfaceAlt }]}>
                          <Text style={[styles.label, { color: colors.textSecondary }]}>Oferta/Proforma</Text>
                          <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.oferta_proforma}</Text>
                        </View>
                      ) : null}
                      {order.customer.numero_factura ? (
                        <View style={[styles.additionalItem, { backgroundColor: colors.surfaceAlt }]}>
                          <Text style={[styles.label, { color: colors.textSecondary }]}>Nº Factura</Text>
                          <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.numero_factura}</Text>
                        </View>
                      ) : null}
                      {order.customer.numero_recibo ? (
                        <View style={[styles.additionalItem, { backgroundColor: colors.surfaceAlt }]}>
                          <Text style={[styles.label, { color: colors.textSecondary }]}>Nº Recibo</Text>
                          <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.numero_recibo}</Text>
                        </View>
                      ) : null}
                    </View>

                    {order.customer.condiciones_entrega ? (
                      <View style={[styles.conditionBlock, { borderTopColor: colors.divider }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Condiciones de Entrega</Text>
                        <Text style={[styles.customerSubvalue, { color: colors.textSecondary }]}>{order.customer.condiciones_entrega}</Text>
                      </View>
                    ) : null}
                    {order.customer.condiciones_pago ? (
                      <View style={[styles.conditionBlock, { borderTopColor: colors.divider }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Condiciones de Pago</Text>
                        <Text style={[styles.customerSubvalue, { color: colors.textSecondary }]}>{order.customer.condiciones_pago}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            )}
          </View>
        </AnimatedSection>

        {!isDesktop && (order.customer.oferta_proforma || order.customer.condiciones_entrega || order.customer.condiciones_pago || order.customer.numero_factura || order.customer.numero_recibo) && (
          <AnimatedSection index={7}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
              <View style={styles.sectionTitle}>
                <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(27, 107, 90, 0.07)' }]}>
                  <FileText size={16} color={colors.primary} />
                </View>
                <Text style={[styles.sectionTitleText, { color: colors.text }]}>Info. Adicional</Text>
              </View>

              <View style={styles.additionalGrid}>
                {order.customer.oferta_proforma ? (
                  <View style={[styles.additionalItem, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Oferta/Proforma</Text>
                    <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.oferta_proforma}</Text>
                  </View>
                ) : null}
                {order.customer.numero_factura ? (
                  <View style={[styles.additionalItem, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Nº Factura</Text>
                    <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.numero_factura}</Text>
                  </View>
                ) : null}
                {order.customer.numero_recibo ? (
                  <View style={[styles.additionalItem, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Nº Recibo</Text>
                    <Text style={[styles.customerValue, { color: colors.text }]}>{order.customer.numero_recibo}</Text>
                  </View>
                ) : null}
              </View>

              {order.customer.condiciones_entrega ? (
                <View style={[styles.conditionBlock, { borderTopColor: colors.divider }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Condiciones de Entrega</Text>
                  <Text style={[styles.customerSubvalue, { color: colors.textSecondary }]}>{order.customer.condiciones_entrega}</Text>
                </View>
              ) : null}
              {order.customer.condiciones_pago ? (
                <View style={[styles.conditionBlock, { borderTopColor: colors.divider }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Condiciones de Pago</Text>
                  <Text style={[styles.customerSubvalue, { color: colors.textSecondary }]}>{order.customer.condiciones_pago}</Text>
                </View>
              ) : null}
            </View>
          </AnimatedSection>
        )}
      </ScrollView>
    </View>
  );
}

function ProductItemAnimated({ children, index }: { children: React.ReactNode; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const delay = Math.min(index * 80, 400);
    Animated.parallel([
      Animated.spring(anim, { toValue: 1, friction: 6, tension: 50, delay, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(slideX, { toValue: 0, friction: 6, tension: 50, delay, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- los valores animados son refs estables
  }, [index]);

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX: slideX }] }}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFoundWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 16, textAlign: 'center' as const },
  headerActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  headerBtn: { padding: 4 },
  scrollContent: { padding: 20, paddingBottom: 40, gap: 16 },
  heroCard: { borderRadius: 20, padding: 20, borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroRefSection: { flex: 1 },
  heroRefLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  heroRefLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1 },
  heroRefNumber: { fontSize: 20, fontWeight: '800' as const, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: -0.5 },
  heroDivider: { height: 1, marginVertical: 16 },
  heroCustomRefSection: { flexDirection: 'row', alignItems: 'center' },
  heroCustomRefLeft: { flex: 1 },
  heroCustomRefLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  heroCustomRefLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1, textTransform: 'uppercase' as const },
  customRefTappable: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderStyle: 'dashed' },
  heroCustomRefValue: { fontSize: 15, fontWeight: '600' as const, flex: 1 },
  editRefIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  editRefRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editRefInput: { flex: 1, borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontWeight: '600' as const },
  editRefBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  totalsCard: { borderRadius: 20, padding: 20, overflow: 'hidden' },
  totalsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  totalsIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  totalsHeaderText: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF', letterSpacing: -0.2 },
  totalsRow: { flexDirection: 'row', alignItems: 'center' },
  totalItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  totalItemLabel: { fontSize: 11, fontWeight: '600' as const, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3, marginBottom: 6 },
  totalItemValue: { fontSize: 17, fontWeight: '800' as const, color: '#FFFFFF', letterSpacing: -0.3 },
  totalItemSub: { fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  totalsDividerV: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, marginTop: 16 },
  grandTotalLabel: { fontSize: 13, fontWeight: '700' as const, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5 },
  grandTotalValue: { fontSize: 26, fontWeight: '800' as const, color: '#FFFFFF', letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 16, borderWidth: 1 },
  metaIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metaTextWrap: { flex: 1 },
  metaLabel: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 2 },
  metaValue: { fontSize: 14, fontWeight: '700' as const },
  metaValueSmall: { fontSize: 12, fontWeight: '600' as const },
  metaCode: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 1 },
  desktopRow: { flexDirection: 'row', gap: 14 },
  desktopMain: { flex: 3, gap: 14 },
  desktopSide: { flex: 2, gap: 14 },
  card: { borderRadius: 20, padding: 20, borderWidth: 1, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitleText: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2, flex: 1 },
  sectionBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  sectionBadgeText: { fontSize: 12, fontWeight: '700' as const },
  productItem: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12 },
  descriptionSection: { marginBottom: 12 },
  descriptionToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  descriptionToggleText: { fontSize: 12, fontWeight: '600' as const, flex: 1 },
  descriptionContent: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  descriptionText: { fontSize: 13, lineHeight: 19 },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  productHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  productIndexBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  productIndexText: { fontSize: 11, fontWeight: '700' as const },
  productNameWrap: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '700' as const, letterSpacing: -0.2 },
  productQty: { fontSize: 12, marginTop: 2 },
  productPriceWrap: { alignItems: 'flex-end' as const, marginLeft: 10 },
  productTotal: { fontSize: 16, fontWeight: '800' as const, letterSpacing: -0.3 },
  productTotalLabel: { fontSize: 10, marginTop: 1 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, borderTopWidth: 1, paddingTop: 12 },
  productGridItem: { width: '33.33%' as any, paddingVertical: 6, paddingHorizontal: 4 },
  gridLabel: { fontSize: 10, letterSpacing: 0.3, marginBottom: 2 },
  gridValue: { fontSize: 13, fontWeight: '700' as const },
  label: { fontSize: 10, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: 0.5, fontWeight: '600' as const },
  customerInfo: { gap: 16 },
  customerField: { paddingBottom: 12, borderBottomWidth: 1 },
  customerFieldWithIcon: { flexDirection: 'row', gap: 12, paddingBottom: 12, borderBottomWidth: 1 },
  fieldIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  fieldIconWrapSmall: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  fieldContent: { flex: 1 },
  contactRow: { flexDirection: 'row', gap: 10, paddingBottom: 12, borderBottomWidth: 1 },
  contactItem: { flex: 1, flexDirection: 'row', gap: 8 },
  customerValue: { fontSize: 14, fontWeight: '600' as const },
  customerSubvalue: { fontSize: 13, marginTop: 2 },
  additionalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  additionalItem: { minWidth: '45%' as any, flex: 1, borderRadius: 12, padding: 12 },
  conditionBlock: { paddingTop: 12, borderTopWidth: 1, marginBottom: 8 },
});
