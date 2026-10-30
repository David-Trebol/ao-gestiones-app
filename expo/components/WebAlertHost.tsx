import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View, type AlertButton } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * En el navegador, Alert.alert de React Native no hace nada.
 * Este componente lo sustituye por un diálogo propio (con varios botones, cancelar y destructivo),
 * así las confirmaciones de borrar, duplicar, salir, errores, etc. funcionan igual que en el móvil.
 */

type PendingAlert = { id: number; title: string; message?: string; buttons: AlertButton[] };

let queue: PendingAlert[] = [];
let listener: ((q: PendingAlert[]) => void) | null = null;
let nextId = 1;

function emit() {
  listener?.([...queue]);
}

if (Platform.OS === 'web') {
  (Alert as unknown as { alert: typeof Alert.alert }).alert = (title, message, buttons) => {
    queue.push({
      id: nextId++,
      title: title ?? '',
      message: message ?? undefined,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    });
    emit();
  };
}

export default function WebAlertHost() {
  const { colors } = useTheme();
  const [items, setItems] = useState<PendingAlert[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    listener = setItems;
    setItems([...queue]);
    return () => {
      listener = null;
    };
  }, []);

  if (Platform.OS !== 'web' || items.length === 0) return null;
  const current = items[0];

  const close = (button?: AlertButton) => {
    queue = queue.filter(a => a.id !== current.id);
    emit();
    // Se ejecuta después de cerrar, para que un nuevo Alert dentro del onPress se muestre bien
    if (button?.onPress) setTimeout(() => button.onPress?.(), 0);
  };

  const cancelButton = current.buttons.find(b => b.style === 'cancel');
  const stacked = current.buttons.length > 2;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(cancelButton)}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay ?? 'rgba(0,0,0,0.45)' }]} onPress={() => cancelButton && close(cancelButton)}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}} accessibilityRole="alert" testID="web-alert">
          <Text style={[styles.title, { color: colors.text }]}>{current.title}</Text>
          {!!current.message && <Text style={[styles.message, { color: colors.textSecondary }]}>{current.message}</Text>}
          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {current.buttons.map((b, i) => {
              const isCancel = b.style === 'cancel';
              const isDestructive = b.style === 'destructive';
              const isPrimary = !isCancel && !isDestructive && (current.buttons.length === 1 || i === current.buttons.length - 1 || stacked);
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => close(b)}
                  style={({ pressed }) => [
                    styles.button,
                    !stacked && styles.buttonFlex,
                    isCancel && { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 },
                    isDestructive && { backgroundColor: colors.error },
                    isPrimary && { backgroundColor: colors.primary },
                    !isCancel && !isDestructive && !isPrimary && { backgroundColor: colors.surfaceAlt },
                    pressed && { opacity: 0.8 },
                  ]}
                  testID={`web-alert-btn-${b.text}`}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: isCancel ? colors.textSecondary : isDestructive || isPrimary ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {b.text ?? 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  message: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  actionsStacked: { flexDirection: 'column' },
  button: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonFlex: { flex: 1 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
