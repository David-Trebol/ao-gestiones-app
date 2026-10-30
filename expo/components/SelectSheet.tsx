import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { radius } from '@/constants/theme';

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
}

/** Lista de opciones: hoja inferior en móvil y ventana centrada en pantallas anchas. */
export default function SelectSheet<T extends string>({ visible, title, options, selected, onSelect, onClose }: Props<T>) {
  const { colors } = useTheme();
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
          ]}
          accessibilityRole={Platform.OS === 'web' ? ('dialog' as never) : undefined}
          accessibilityLabel={title}
        >
          {!wide && <View style={[styles.grabber, { backgroundColor: colors.border }]} />}
          <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
          <ScrollView>
            {options.map(o => {
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
  title: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 20, paddingBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  optionLabel: { fontSize: 16, letterSpacing: -0.2 },
  hint: { fontSize: 13, marginTop: 2 },
  cancel: { margin: 12, marginTop: 8, minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600' },
});
