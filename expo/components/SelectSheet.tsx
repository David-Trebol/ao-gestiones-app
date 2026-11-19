import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enter } from '@/constants/motion';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, webInputReset } from '@/constants/theme';

/** Quita acentos y mayúsculas para buscar («Martinez» encuentra «Martínez») */
const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export interface SheetOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  destructive?: boolean;
}

interface Props<T extends string> {
  visible: boolean;
  title: string;
  options: SheetOption<T>[];
  selected?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  /** Muestra un buscador encima de la lista (para listas largas, como los fabricantes) */
  searchable?: boolean;
  searchPlaceholder?: string;
}

/** Lista de opciones: hoja inferior en móvil y ventana centrada en pantallas anchas. */
export default function SelectSheet<T extends string>({ visible, title, options, selected, onSelect, onClose, searchable, searchPlaceholder = 'Buscar' }: Props<T>) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);
  const shown = useMemo(() => {
    const q = fold(query.trim());
    return q ? options.filter(o => fold(o.label).includes(q) || (o.hint ? fold(o.hint).includes(q) : false)) : options;
  }, [options, query]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 768;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay, justifyContent: wide ? 'center' : 'flex-end' }]} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable
          onPress={() => {}}
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, maxHeight: height * 0.75, paddingBottom: wide ? 8 : 8 + insets.bottom },
            wide ? styles.sheetWide : styles.sheetMobile,
            enter(0, wide ? 'pop' : 'rise', { duration: 300 }),
          ]}
          accessibilityRole={Platform.OS === 'web' ? ('dialog' as never) : undefined}
          accessibilityLabel={title}
        >
          {!wide && <View style={[styles.grabber, { backgroundColor: colors.border }]} />}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {searchable && (
            <View style={[styles.search, { backgroundColor: colors.fill }]}>
              <Search size={17} color={colors.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textTertiary}
                style={[styles.searchInput, { color: colors.text }]}
                autoFocus={Platform.OS === 'web'}
                autoCorrect={false}
                accessibilityLabel={searchPlaceholder}
                testID="sheet-search"
              />
            </View>
          )}
          <ScrollView keyboardShouldPersistTaps="handled">
            {searchable && shown.length === 0 && <Text style={[styles.hint, styles.noResults, { color: colors.textSecondary }]}>Nada coincide con «{query}».</Text>}
            {shown.map(o => {
              const isSel = o.value === selected;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onSelect(o.value);
                    onClose();
                  }}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.option,
                    { borderTopColor: colors.divider, backgroundColor: pressed || hovered ? colors.fill : 'transparent' },
                  ]}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: isSel }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: o.destructive ? colors.error : colors.text }, isSel && { fontWeight: '600' }]}>{o.label}</Text>
                    {!!o.hint && <Text style={[styles.hint, { color: colors.textSecondary }]}>{o.hint}</Text>}
                  </View>
                  {isSel && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.cancel, { backgroundColor: colors.fill, opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button">
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center' },
  sheet: { width: '100%', paddingTop: 8 },
  sheetMobile: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  sheetWide: { maxWidth: 420, borderRadius: radius.xl, paddingTop: 12 },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, paddingHorizontal: 20, paddingBottom: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 10, height: 40, borderRadius: 10 },
  searchInput: { flex: 1, minWidth: 0, height: 40, fontSize: 17, letterSpacing: -0.2, ...webInputReset },
  noResults: { paddingHorizontal: 20, paddingVertical: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  optionLabel: { fontSize: 16, letterSpacing: -0.2 },
  hint: { fontSize: 13, marginTop: 2 },
  cancel: { margin: 12, marginTop: 8, minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600' },
});
