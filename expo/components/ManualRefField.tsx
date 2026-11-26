import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { AlertTriangle, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { webInputReset } from '@/constants/theme';
import { manualRefSuffix } from '@/utils/references';

type Props = {
  /** Código de la referencia de pedido (ESP, AO…). Sin código no hay prefijo ni sugerencia. */
  code: string;
  year?: number;
  /** Valor guardado o escrito (ESP-628, 628 o texto libre). */
  value: string;
  onChange: (v: string) => void;
  /** Siguiente número propuesto y última referencia usada. */
  suggestion: { number: number; last: string } | null;
  /** Aviso si otro pedido ya tiene esta referencia (no impide guardar). */
  duplicateOf?: string | null;
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
};

/**
 * Referencia propia del pedido: «ESP-» fijo delante y el número detrás, con un botón
 * «Continuar con ESP-629» que rellena el siguiente. Siempre se puede escribir a mano.
 */
export default function ManualRefField({ code, year, value, onChange, suggestion, duplicateOf, label = 'Referencia', style, testID = 'manual-ref', autoFocus, onSubmit }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const prefix = code ? `${code.toUpperCase()}-` : '';
  const shown = code ? manualRefSuffix(value, code) : value;
  // Solo con el campo vacío: en un pedido que ya tiene referencia no se propone otra.
  const offer = suggestion && !shown.trim() ? suggestion : null;

  return (
    <View style={style}>
      {!!label && <Text style={[st.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View style={[st.box, { backgroundColor: colors.fill, borderColor: duplicateOf ? colors.error : focused ? colors.primary : 'transparent' }]}>
        {!!prefix && (
          <View style={[st.prefix, { backgroundColor: colors.primarySoft }]}>
            <Text style={[st.prefixText, { color: colors.primary }]} testID={`${testID}-prefix`}>{prefix}</Text>
          </View>
        )}
        <TextInput
          style={[st.input, { color: colors.text }]}
          value={shown}
          onChangeText={(t) => onChange(t.toUpperCase())}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={suggestion ? String(suggestion.number) : code ? 'Número' : 'Elige antes la referencia'}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
          autoFocus={autoFocus}
          onSubmitEditing={onSubmit}
          accessibilityLabel={prefix ? `${label || 'Referencia'}: número detrás de ${prefix}` : label || 'Referencia'}
          testID={`${testID}-input`}
        />
        {!!year && !!shown && <Text style={[st.year, { color: colors.textSecondary }]}>({year})</Text>}
      </View>
      {duplicateOf ? (
        <View style={st.dup} testID={`${testID}-dup`} accessibilityRole="alert">
          <AlertTriangle size={14} color={colors.error} />
          <Text style={[st.dupText, { color: colors.error }]}>{duplicateOf}</Text>
        </View>
      ) : null}
      {offer ? (
        <Pressable
          onPress={() => onChange(String(offer.number))}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [st.suggest, { backgroundColor: hovered || pressed ? colors.primarySoftAlt : colors.primarySoft }]}
          accessibilityRole="button"
          accessibilityLabel={`Continuar con ${prefix}${offer.number}`}
          testID={`${testID}-next`}
        >
          <Text style={[st.suggestText, { color: colors.primary }]} numberOfLines={1}>
            Continuar con <Text style={st.suggestStrong}>{prefix}{offer.number}</Text>
          </Text>
          <ArrowRight size={14} color={colors.primary} />
          <Text style={[st.suggestLast, { color: colors.textSecondary }]} numberOfLines={1}>última: {offer.last}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, minHeight: 44, paddingLeft: 6, paddingRight: 10, gap: 6 },
  prefix: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  prefixText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2, fontVariant: ['tabular-nums'] },
  input: { flex: 1, minWidth: 40, fontSize: 16, paddingVertical: 9, letterSpacing: -0.2, fontVariant: ['tabular-nums'], ...webInputReset, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  year: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  suggest: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', flexWrap: 'wrap', gap: 6, marginTop: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '100%' },
  suggestText: { fontSize: 13, fontWeight: '600' },
  suggestStrong: { fontWeight: '800' },
  suggestLast: { fontSize: 12 },
  dup: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  dupText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
});
