import React, { useState, useCallback, useRef, useEffect } from 'react';
import { NATIVE_DRIVER } from '@/constants/animation';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, X, FileText } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { webInputReset } from '@/constants/theme';
import { useSearchOrders } from '@/contexts/DataContext';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency } from '@/utils/calculations';
import { Order } from '@/types';
import * as Haptics from 'expo-haptics';

function getMatchedField(order: Order, term: string): { field: string; value: string } | null {
  const t = term.toLowerCase();
  const c = order.customer;
  if (order.reference_number?.toLowerCase().includes(t)) return { field: 'Referencia', value: order.reference_number };
  if (order.custom_reference?.toLowerCase().includes(t)) return { field: 'Ref. Manual', value: order.custom_reference };
  if (c.nombre_empresa?.toLowerCase().includes(t)) return { field: 'Empresa', value: c.nombre_empresa };
  if (c.contacto?.toLowerCase().includes(t)) return { field: 'Contacto', value: c.contacto };
  if (c.direccion_1?.toLowerCase().includes(t)) return { field: 'Dirección', value: c.direccion_1 };
  if (c.provincia?.toLowerCase().includes(t)) return { field: 'Provincia', value: c.provincia };
  if (c.email?.toLowerCase().includes(t)) return { field: 'Email', value: c.email };
  if (c.telefono_1?.toLowerCase().includes(t)) return { field: 'Teléfono', value: c.telefono_1 };
  if (c.nif?.toLowerCase().includes(t)) return { field: 'NIF', value: c.nif };
  if (c.numero_factura?.toLowerCase().includes(t)) return { field: 'Nº Factura', value: c.numero_factura };
  if (order.manufacturer_name?.toLowerCase().includes(t)) return { field: 'Fabricante', value: order.manufacturer_name };
  const matchedProduct = order.items?.find(item => item.product_name?.toLowerCase().includes(t));
  if (matchedProduct) return { field: 'Producto', value: matchedProduct.product_name };
  const matchedShipping = order.shipping_items?.find(s => s.description?.toLowerCase().includes(t));
  if (matchedShipping) return { field: 'Envío', value: matchedShipping.description };
  return null;
}

function AnimatedResultCard({ children, index }: { children: React.ReactNode; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(12)).current;
  const scaleVal = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    const delay = Math.min(index * 80, 400);
    Animated.parallel([
      Animated.spring(anim, { toValue: 1, friction: 5, tension: 40, delay, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(slideY, { toValue: 0, friction: 5, tension: 40, delay, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(scaleVal, { toValue: 1, friction: 4, tension: 50, delay, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [anim, index, scaleVal, slideY]);

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: slideY }, { scale: scaleVal }] }}>
      {children}
    </Animated.View>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const isDesktop = width >= 1024;
  const isCompact = width < 420;
  const contentMaxWidth = isDesktop ? 760 : width;

  const [searchTerm, setSearchTerm] = useState('');
  const results = useSearchOrders(searchTerm);

  const searchBarScale = useRef(new Animated.Value(0.96)).current;
  const searchBarOpacity = useRef(new Animated.Value(0)).current;
  const searchBarSlide = useRef(new Animated.Value(-20)).current;
  const emptyFade = useRef(new Animated.Value(0)).current;
  const emptyScale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(searchBarScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(searchBarOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(searchBarSlide, { toValue: 0, friction: 5, tension: 50, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
    Animated.parallel([
      Animated.timing(emptyFade, { toValue: 1, duration: 600, delay: 250, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(emptyScale, { toValue: 1, friction: 4, tension: 40, delay: 250, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [emptyFade, emptyScale, searchBarOpacity, searchBarScale, searchBarSlide]);

  const handleSelectOrder = useCallback((order: Order) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/order-detail?orderId=${order.id}` as any);
  }, [router]);

  const renderItem = useCallback(({ item, index }: { item: Order; index: number }) => {
    const matchedField = getMatchedField(item, searchTerm);

    return (
      <AnimatedResultCard index={index}>
        <Pressable
          style={({ pressed }) => [styles.resultCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight, shadowColor: colors.cardShadow, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => handleSelectOrder(item)}
          testID={`search-result-${item.id}`}
        >
          <View style={[styles.resultHeader, isCompact && styles.resultHeaderCompact]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.resultRef, { color: colors.text }]}>{item.reference_number}</Text>
              <Text style={[styles.resultCustomer, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.customer.nombre_empresa}
              </Text>
              <View style={styles.resultMeta}>
                <Text style={[styles.resultMetaText, { color: colors.textTertiary }]}>{item.manufacturer_name}</Text>
                <View style={[styles.metaDot, { backgroundColor: colors.textTertiary }]} />
                <Text style={[styles.resultMetaText, { color: colors.textTertiary }]}>{item.year}</Text>
              </View>
              {matchedField && (
                <View style={[styles.matchBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.matchField, { color: colors.primary }]}>{matchedField.field}:</Text>
                  <Text style={[styles.matchValue, { color: colors.text }]} numberOfLines={1}>{matchedField.value}</Text>
                </View>
              )}
            </View>
            <View style={[styles.resultRight, isCompact && styles.resultRightCompact]}>
              <Text style={[styles.resultTotal, { color: colors.text }]}>{formatCurrency(item.total_with_vat)}</Text>
              <StatusBadge status={item.status} size="sm" />
            </View>
          </View>
        </Pressable>
      </AnimatedResultCard>
    );
  }, [searchTerm, handleSelectOrder, colors, isCompact]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.innerContainer, { maxWidth: contentMaxWidth }]}>
        <Animated.View style={[styles.searchBar, { backgroundColor: colors.fill, transform: [{ scale: searchBarScale }, { translateY: searchBarSlide }], opacity: searchBarOpacity }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Buscar por nombre, dirección, NIF..."
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            testID="global-search-input"
          />
          {searchTerm.length > 0 && (
            <Pressable onPress={() => setSearchTerm('')} hitSlop={8} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.8 : 1 }] }]}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </Animated.View>

        {searchTerm.length === 0 ? (
          <Animated.View style={[styles.emptyContainer, { opacity: emptyFade, transform: [{ scale: emptyScale }] }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceAlt }]}>
              <Search size={34} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Buscar Pedidos</Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
              Busca por empresa, contacto, dirección, producto, NIF, teléfono, referencia...
            </Text>
          </Animated.View>
        ) : results.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceAlt }]}>
              <FileText size={34} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin resultados</Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
              No se encontraron pedidos para «{searchTerm}»
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </Text>
            <FlatList
              data={results}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>
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
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 14, marginBottom: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderWidth: 0 },
  searchInput: { flex: 1, fontSize: 17, padding: 0, letterSpacing: -0.3, ...webInputReset },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIconWrap: { width: 76, height: 76, borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700' as const,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 21,
  },
  resultsCount: { fontSize: 13, fontWeight: '500' as const,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  resultCard: { borderRadius: 18, padding: 16, borderWidth: 0, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  resultHeaderCompact: {
    flexDirection: 'column',
  },
  resultRef: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  resultCustomer: { fontSize: 15,
    marginTop: 3,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  resultMetaText: { fontSize: 13,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start' as const,
  },
  matchField: { fontSize: 12,
    fontWeight: '600' as const,
  },
  matchValue: { fontSize: 12,
    maxWidth: 160,
  },
  resultRight: {
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between',
    gap: 8,
    marginLeft: 12,
    minWidth: 96,
    flexShrink: 0,
  },
  resultRightCompact: {
    width: '100%' as const,
    marginLeft: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultTotal: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.3, fontVariant: ['tabular-nums'],
  },
});
