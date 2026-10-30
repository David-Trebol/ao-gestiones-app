import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { KeyRound } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

/** Pantalla que aparece al abrir el enlace del email "crear/restablecer contraseña" */
export default function ResetPasswordScreen() {
  const { updatePassword, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setError('');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    setLoading(true);
    const r = await updatePassword(password);
    setLoading(false);
    if (!r.success) setError(r.error || 'No se pudo guardar la contraseña');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}><KeyRound size={22} color="#FF4D2D" /></View>
        <Text style={styles.title}>Crea tu nueva contraseña</Text>
        <Text style={styles.subtitle}>Mínimo 8 caracteres. La usarás para entrar en Flow.</Text>
        {error !== '' && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.label}>Nueva contraseña</Text>
        <TextInput
          style={[styles.input, Platform.OS === 'web' && styles.inputWeb]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="Nueva contraseña"
          placeholderTextColor="#6B6B7B"
          testID="reset-password"
        />
        <Text style={styles.label}>Repite la contraseña</Text>
        <TextInput
          style={[styles.input, Platform.OS === 'web' && styles.inputWeb]}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="Repite la contraseña"
          placeholderTextColor="#6B6B7B"
          onSubmitEditing={handleSave}
          testID="reset-password-confirm"
        />
        <Pressable style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading} testID="reset-save">
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Guardar contraseña</Text>}
        </Pressable>
        <Pressable onPress={() => void logout()} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#131318', borderRadius: 18, borderWidth: 1, borderColor: '#2A2A35', padding: 24 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,77,45,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#9595A5', fontSize: 13, marginTop: 6, marginBottom: 16 },
  error: { color: '#FF8A75', backgroundColor: 'rgba(255,77,45,0.1)', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 },
  label: { color: '#9595A5', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 6 },
  input: { backgroundColor: '#0E0E13', borderWidth: 1, borderColor: '#2A2A35', borderRadius: 10, color: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  inputWeb: { outlineStyle: 'none' } as any,
  button: { backgroundColor: '#FF4D2D', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  cancel: { alignItems: 'center', marginTop: 12 },
  cancelText: { color: '#6B6B7B', fontSize: 13 },
});
