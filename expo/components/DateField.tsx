import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { webInputReset } from '@/constants/theme';

interface Props {
  label: string;
  /** AAAA-MM-DD o null */
  value: string | null;
  onChange: (iso: string | null) => void;
  hint?: string;
  tone?: 'normal' | 'danger';
}

const toDisplay = (iso: string | null) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** Campo de fecha: selector nativo del navegador en web; dd/mm/aaaa en la app. Se puede vaciar. */
export default function DateField({ label, value, onChange, hint, tone = 'normal' }: Props) {
  const { colors, isDark } = useTheme();
  const [text, setText] = useState(toDisplay(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => setText(toDisplay(value)), [value]);
  const border = tone === 'danger' ? colors.error : focused ? colors.primary : 'transparent';

  const input =
    Platform.OS === 'web' ? (
      React.createElement('input', {
        type: 'date',
        value: value ?? '',
        'aria-label': label,
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        onChange: (e: { target: { value: string } }) => onChange(e.target.value || null),
        style: {
          flex: 1,
          minWidth: 0,
          height: 44,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: colors.text,
          fontSize: 16,
          fontFamily: 'inherit',
          colorScheme: isDark ? 'dark' : 'light',
          padding: 0,
        },
      })
    ) : (
      <TextInput
        value={text}
        onChangeText={t => {
          const clean = t.replace(/[^0-9/]/g, '').slice(0, 10);
          setText(clean);
          const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean);
          if (m) onChange(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
          if (!clean) onChange(null);
        }}
        placeholder="dd/mm/aaaa"
        placeholderTextColor={colors.textTertiary}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.native, { color: colors.text }, webInputReset]}
      />
    );

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: tone === 'danger' ? colors.error : colors.textSecondary }]}>{label}</Text>
      <View style={[styles.box, { backgroundColor: colors.fill, borderColor: border }]}>
        {input}
        {!!value && (
          <Pressable onPress={() => onChange(null)} hitSlop={8} style={styles.clear} accessibilityRole="button" accessibilityLabel={`Quitar ${label.toLowerCase()}`}>
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {!!hint && <Text style={[styles.hint, { color: tone === 'danger' ? colors.error : colors.textSecondary }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12, flex: 1, minWidth: 150 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, minHeight: 46 },
  native: { flex: 1, fontSize: 16, height: 44 },
  clear: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12, marginTop: 4, lineHeight: 16 },
});
