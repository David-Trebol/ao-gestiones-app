import React from 'react';
import { Pressable, StyleSheet, TextInput, View, ViewStyle } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { webInputReset } from '@/constants/theme';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  testID?: string;
  style?: ViewStyle;
}

/** Buscador común (lupa, fondo de relleno, ✕ para borrar): el mismo aspecto que el del inicio. */
export default function SearchField({ value, onChangeText, placeholder, testID, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.fill }, style]}>
      <Search size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.text }]}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        testID={testID}
      />
      {!!value && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" style={styles.clear}>
          <X size={16} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 12 },
  input: { flex: 1, minWidth: 0, fontSize: 17, height: 44, letterSpacing: -0.2, ...webInputReset },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
