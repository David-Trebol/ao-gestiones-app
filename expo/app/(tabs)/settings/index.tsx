import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import {
  FolderOpen,
  Building2,
  FileText,
  Trash2,
  Info,
  KeyRound,
  LogOut,
  Users,
  UserPlus,
  Edit3,
  Shield,
  User,
  X,
  Monitor,
  Moon,
  Sun,
  Fingerprint,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth, AppUser } from '@/contexts/AuthContext';
import { formatCurrency } from '@/utils/calculations';
import { webInputReset } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { orders, manufacturers, years, deleteAllData } = useData();
  const { currentUser, users, isAdmin, logout, addUser, updateUser, deleteUser, biometricEnabled, biometricAvailable, toggleBiometric, requestPasswordReset } = useAuth();
  const router = useRouter();
  const { colors, isDark, themeMode, setTheme } = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isCompact = width < 480;
  const contentMaxWidth = isDesktop ? 760 : width;

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'user'>('user');
  const [formActive, setFormActive] = useState(true);

  const totalOrders = orders.length;
  const totalManufacturers = manufacturers.length;
  const totalYears = years.length;
  const totalAmount = orders.reduce((sum, o) => sum + o.total_with_vat, 0);


  const handleClearAll = useCallback(() => {
    Alert.alert(
      '¿Eliminar TODOS los datos?',
      `Se borrarán ${orders.length} pedidos, ${manufacturers.length} fabricantes y ${years.length} años de la base de datos, para todos los usuarios. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todo',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteAllData();
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert('Datos eliminados', 'La base de datos está vacía.');
            } catch (e) {
              Alert.alert('No se pudo eliminar', (e as Error).message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [deleteAllData, orders.length, manufacturers.length, years.length]);

  const handleChangePassword = useCallback(() => {
    if (!currentUser?.email) return;
    Alert.alert(
      'Cambiar contraseña',
      `Te enviaremos un email a ${currentUser.email} con un enlace para elegir una contraseña nueva.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar email',
          onPress: async () => {
            const r = await requestPasswordReset(currentUser.email);
            if (r.success) Alert.alert('Email enviado', 'Revisa tu bandeja de entrada (y la carpeta de spam).');
            else Alert.alert('No se pudo enviar', r.error || 'Inténtalo más tarde');
          },
        },
      ]
    );
  }, [currentUser, requestPasswordReset]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: () => {
            void logout();
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [logout]);

  const openCreateUser = useCallback(() => {
    setEditingUser(null);
    setFormUsername('');
    setFormPassword('');
    setFormDisplayName('');
    setFormRole('user');
    setFormActive(true);
    setUserModalOpen(true);
  }, []);

  const openEditUser = useCallback((user: AppUser) => {
    setEditingUser(user);
    setFormUsername(user.email);
    setFormPassword('');
    setFormDisplayName(user.displayName);
    setFormRole(user.role);
    setFormActive(user.active);
    setUserModalOpen(true);
  }, []);

  const handleSaveUser = useCallback(async () => {
    const email = formUsername.trim().toLowerCase();
    if (!email || !formDisplayName.trim()) {
      Alert.alert('Error', 'Completa email y nombre');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Error', 'El email no es válido');
      return;
    }
    if (formPassword && formPassword.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setSavingUser(true);
    try {
      if (editingUser) {
        const result = await updateUser(editingUser.id, {
          email: email !== editingUser.email ? email : undefined,
          password: formPassword || undefined,
          displayName: formDisplayName.trim(),
          role: formRole,
          active: formActive,
        });
        if (!result.success) {
          Alert.alert('Error', result.error || 'No se pudo actualizar');
          return;
        }
      } else {
        if (!formPassword) {
          Alert.alert('Error', 'La contraseña es obligatoria (mínimo 8 caracteres)');
          return;
        }
        const result = await addUser(email, formPassword, formDisplayName.trim(), formRole);
        if (!result.success) {
          Alert.alert('Error', result.error || 'No se pudo crear');
          return;
        }
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUserModalOpen(false);
    } finally {
      setSavingUser(false);
    }
  }, [editingUser, formUsername, formPassword, formDisplayName, formRole, formActive, addUser, updateUser]);

  const handleDeleteUser = useCallback((user: AppUser) => {
    Alert.alert(
      '¿Eliminar usuario?',
      `Se eliminará "${user.displayName}" permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteUser(user.id);
            if (!result.success) {
              Alert.alert('Error', result.error || 'No se pudo eliminar');
            } else {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
          },
        },
      ]
    );
  }, [deleteUser]);

  const handleToggleBiometric = useCallback(async () => {
    await toggleBiometric();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [toggleBiometric]);

  const handleSetTheme = useCallback((mode: 'light' | 'dark') => {
    void setTheme(mode);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [setTheme]);


  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as any }]} showsVerticalScrollIndicator={false}>

        <View style={[styles.userBanner, isCompact && styles.userBannerCompact, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
          <View style={styles.userBannerLeft}>
            <View style={[styles.userAvatar, { backgroundColor: isAdmin ? colors.primary : colors.textSecondary }]}>
              {isAdmin ? <Shield size={20} color="#FFFFFF" /> : <User size={20} color="#FFFFFF" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.userBannerName, { color: colors.text }]}>{currentUser?.displayName}</Text>
              {currentUser?.email && (
                <Text style={[styles.userEmail, { color: colors.textTertiary }]} numberOfLines={1}>{currentUser.email}</Text>
              )}
              <View style={styles.userRoleBadgeRow}>
                <View style={styles.userRoleBadge}>
                  <Text style={[styles.userRoleText, { color: colors.textSecondary }]}>{isAdmin ? 'Administrador' : 'Usuario'}</Text>
                </View>
              </View>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, isCompact && styles.logoutBtnCompact, { backgroundColor: colors.errorBg, borderColor: colors.errorBorder }, pressed && { opacity: 0.8 }]}
            onPress={handleLogout}
            testID="logout-btn"
          >
            <LogOut size={15} color={colors.error} />
            <Text style={[styles.logoutBtnText, { color: colors.error }]}>Salir</Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
          <View style={styles.sectionTitleRow}>
            {isDark ? <Moon size={17} color={colors.primary} /> : <Sun size={17} color={colors.primary} />}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Apariencia</Text>
          </View>

          <View style={styles.themeSelector}>
            <Pressable
              style={({ pressed }) => [
                styles.themeOption,
                { borderColor: themeMode === 'light' ? colors.primary : colors.border, backgroundColor: themeMode === 'light' ? colors.primarySoft : colors.surfaceAlt, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
              onPress={() => handleSetTheme('light')}
            >
              <View style={[styles.themeIconWrap, { backgroundColor: themeMode === 'light' ? colors.primary : colors.surfaceAlt }]}>
                <Sun size={18} color={themeMode === 'light' ? '#FFFFFF' : colors.textTertiary} />
              </View>
              <Text style={[styles.themeOptionText, { color: themeMode === 'light' ? colors.primary : colors.textSecondary }]}>Claro</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.themeOption,
                { borderColor: themeMode === 'dark' ? colors.primary : colors.border, backgroundColor: themeMode === 'dark' ? colors.primarySoft : colors.surfaceAlt, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
              onPress={() => handleSetTheme('dark')}
            >
              <View style={[styles.themeIconWrap, { backgroundColor: themeMode === 'dark' ? colors.primary : colors.surfaceAlt }]}>
                <Moon size={18} color={themeMode === 'dark' ? '#FFFFFF' : colors.textTertiary} />
              </View>
              <Text style={[styles.themeOptionText, { color: themeMode === 'dark' ? colors.primary : colors.textSecondary }]}>Oscuro</Text>
            </Pressable>
          </View>

          {(Platform.OS !== 'web' && biometricAvailable) && (
            <View style={[styles.biometricRow, { borderTopColor: colors.divider }]}>
              <View style={styles.biometricLeft}>
                <View style={[styles.biometricIconWrap, { backgroundColor: colors.primarySoft }]}>
                  <Fingerprint size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.biometricTitle, { color: colors.text }]}>Acceso con huella</Text>
                  <Text style={[styles.biometricSubtitle, { color: colors.textSecondary }]}>Desbloquea la app con tu huella digital</Text>
                </View>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={biometricEnabled ? colors.primary : colors.textTertiary}
              />
            </View>
          )}
        </View>

        <View style={isDesktop ? styles.desktopRow : undefined}>
          <View style={isDesktop ? styles.desktopHalf : undefined}>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Resumen</Text>

              <View style={[styles.statsGrid, isCompact && styles.statsGridCompact]}>
                <View style={[styles.statCard, isCompact && styles.statCardCompact, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.surface }]}>
                    <FileText size={19} color={colors.primary} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{totalOrders}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pedidos</Text>
                </View>
                <View style={[styles.statCard, isCompact && styles.statCardCompact, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.surface }]}>
                    <Building2 size={19} color={colors.primary} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{totalManufacturers}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Fabricantes</Text>
                </View>
                <View style={[styles.statCard, isCompact && styles.statCardCompact, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.surface }]}>
                    <FolderOpen size={19} color={colors.primary} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{totalYears}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Años</Text>
                </View>
              </View>

              <View style={[styles.totalAmountCard, { backgroundColor: colors.heroTile }]}>
                <Text style={styles.totalAmountLabel}>Facturación Total</Text>
                <Text style={styles.totalAmountValue}>{formatCurrency(totalAmount)}</Text>
              </View>
            </View>
          </View>

          <View style={isDesktop ? styles.desktopHalf : undefined}>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Estado de Pedidos</Text>
              <Text style={[styles.statusLabel, { color: colors.textSecondary, fontSize: 15, lineHeight: 21 }]}>
                El resumen por estados está ahora en la pantalla principal (Pedidos), donde cada contador abre la lista filtrada.
              </Text>
              <Pressable onPress={() => router.push('/' as never)} style={({ pressed }) => [styles.statusMoved, { backgroundColor: colors.fill, opacity: pressed ? 0.7 : 1 }]} accessibilityRole="link">
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Ir a Pedidos</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {isAdmin && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <Users size={17} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Gestión de Usuarios</Text>
              </View>
              <Pressable style={[styles.addUserBtn, { backgroundColor: colors.primary }]} onPress={openCreateUser} testID="add-user-btn">
                <UserPlus size={14} color="#FFFFFF" />
                <Text style={styles.addUserBtnText}>Nuevo</Text>
              </Pressable>
            </View>

            {users.map(user => (
              <View key={user.id} style={[styles.userRow, { borderBottomColor: colors.divider }]}>
                <View style={styles.userRowLeft}>
                  <View style={[styles.userRowAvatar, { backgroundColor: user.role === 'admin' ? colors.primary : colors.textSecondary }]}>
                    {user.role === 'admin' ? <Shield size={14} color="#FFFFFF" /> : <User size={14} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userRowName, { color: colors.text }]}>{user.displayName}</Text>
                    <Text style={[styles.userRowUsername, { color: colors.textTertiary }]}>
                      {user.email}
                    </Text>
                    <View style={styles.userRowMeta}>
                      <View style={[styles.userRolePill, { backgroundColor: user.role === 'admin' ? colors.primarySoft : colors.fill }]}>
                        <Text style={[styles.rolePillText, { color: user.role === 'admin' ? colors.primary : colors.textSecondary }]}>
                          {user.role === 'admin' ? 'Admin' : 'Usuario'}
                        </Text>
                      </View>
                      {!user.active && (
                        <View style={[styles.inactivePill, { backgroundColor: colors.errorBg }]}>
                          <Text style={[styles.inactivePillText, { color: colors.error }]}>Inactivo</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.userRowActions}>
                  <Pressable onPress={() => openEditUser(user)} style={[styles.userActionBtn, { backgroundColor: colors.surfaceAlt }]} hitSlop={8}>
                    <Edit3 size={14} color={colors.textSecondary} />
                  </Pressable>
                  {user.id !== currentUser?.id && (
                    <Pressable onPress={() => handleDeleteUser(user)} style={[styles.userActionBtn, { backgroundColor: colors.errorBg }]} hitSlop={8}>
                      <Trash2 size={14} color={colors.error} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cuenta y datos</Text>
          <Pressable style={[styles.menuItem, { borderBottomColor: colors.divider }]} onPress={handleChangePassword} testID="change-password-btn">
            <View style={[styles.menuIconWrap, { backgroundColor: colors.primarySoft }]}>
              <KeyRound size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuItemTitle, { color: colors.text }]}>Cambiar mi contraseña</Text>
              <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>Te enviamos un enlace seguro por email</Text>
            </View>
          </Pressable>

          {isAdmin && (
            <>
              <Pressable style={[styles.menuItem, { borderBottomColor: colors.divider }, deleting && { opacity: 0.5 }]} onPress={handleClearAll} disabled={deleting} testID="delete-all-btn">
                <View style={[styles.menuIconWrap, { backgroundColor: colors.errorBg }]}>
                  <Trash2 size={17} color={colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuItemTitle, { color: colors.error }]}>Eliminar todos los datos</Text>
                  <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>Borra todos los pedidos, fabricantes y años</Text>
                </View>
              </Pressable>
            </>
          )}

          {!isAdmin && (
            <View style={styles.noAdminNotice}>
              <Text style={[styles.noAdminText, { color: colors.textTertiary }]}>Solo los administradores pueden borrar datos o gestionar usuarios</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}>
          <View style={styles.sectionTitleRow}>
            <Monitor size={17} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Plataforma</Text>
          </View>
          <View style={[styles.platformInfo, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.platformText, { color: colors.text }]}>
              {Platform.OS === 'web' ? 'Navegador Web (PC/Mac)' : Platform.OS === 'ios' ? 'iOS' : 'Android'}
            </Text>
            <Text style={[styles.platformSubtext, { color: colors.textSecondary }]}>
              {Platform.OS === 'web'
                ? 'Optimizado para escritorio y pantallas grandes'
                : 'Aplicación nativa móvil'}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerBadge}>
            <Info size={14} color={colors.textTertiary} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>AO Gestiones</Text>
          </View>
          <Text style={[styles.footerSubtext, { color: colors.textTertiary }]}>Pedidos en movimiento · Multiplataforma</Text>
        </View>
      </ScrollView>

      <Modal visible={userModalOpen} transparent animationType="fade" onRequestClose={() => setUserModalOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editingUser ? 'Editar Usuario' : 'Crear Usuario'}</Text>
              <Pressable onPress={() => setUserModalOpen(false)} hitSlop={10}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Email *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formUsername}
                onChangeText={setFormUsername}
                placeholder="persona@empresa.com"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                testID="user-form-username"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{editingUser ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña * (mínimo 8 caracteres)'}</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formPassword}
                onChangeText={setFormPassword}
                placeholder={editingUser ? '••••••' : 'Contraseña'}
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                testID="user-form-password"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Nombre visible *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formDisplayName}
                onChangeText={setFormDisplayName}
                placeholder="Nombre completo"
                placeholderTextColor={colors.textTertiary}
                testID="user-form-displayname"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Rol</Text>
              <View style={styles.roleSelector}>
                <Pressable
                  style={[styles.roleOption, { borderColor: formRole === 'admin' ? colors.primary : colors.border, backgroundColor: formRole === 'admin' ? colors.primary : colors.surface }]}
                  onPress={() => setFormRole('admin')}
                >
                  <Shield size={14} color={formRole === 'admin' ? '#FFFFFF' : colors.textSecondary} />
                  <Text style={[styles.roleOptionText, { color: formRole === 'admin' ? '#FFFFFF' : colors.textSecondary }]}>Admin</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleOption, { borderColor: formRole === 'user' ? colors.primary : colors.border, backgroundColor: formRole === 'user' ? colors.primary : colors.surface }]}
                  onPress={() => setFormRole('user')}
                >
                  <User size={14} color={formRole === 'user' ? '#FFFFFF' : colors.textSecondary} />
                  <Text style={[styles.roleOptionText, { color: formRole === 'user' ? '#FFFFFF' : colors.textSecondary }]}>Usuario</Text>
                </Pressable>
              </View>
            </View>

            {editingUser && (
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Cuenta activa</Text>
                <Switch
                  value={formActive}
                  onValueChange={setFormActive}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={formActive ? colors.primary : colors.textTertiary}
                />
              </View>
            )}

            <View style={[styles.modalActions, { borderTopColor: colors.divider }]}>
              <Pressable style={[styles.modalCancelBtn, { borderColor: colors.border }]} onPress={() => setUserModalOpen(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirmBtn, { backgroundColor: colors.primary, opacity: savingUser ? 0.6 : 1 }]} onPress={handleSaveUser} disabled={savingUser} testID="user-form-save">
                <Text style={styles.modalConfirmText}>{savingUser ? 'Guardando…' : editingUser ? 'Actualizar' : 'Crear'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  userBanner: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  userBannerCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  userBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  userAvatar: { width: 52, height: 52, borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBannerName: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.4, },
  userEmail: { fontSize: 14, marginTop: 2, },
  userRoleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  userRoleBadge: {
    marginTop: 0,
  },
  userRoleText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  googleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
  },
  googleBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 0, },
  logoutBtnCompact: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  logoutBtnText: { fontSize: 15, fontWeight: '600' as const, },
  desktopRow: {
    flexDirection: 'row',
    gap: 16,
  },
  desktopHalf: {
    flex: 1,
  },
  section: { borderRadius: 20, padding: 20, marginBottom: 18, borderWidth: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700' as const, marginBottom: 0, letterSpacing: -0.4, },
  themeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  themeOption: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, gap: 8, },
  themeIconWrap: { width: 40, height: 40, borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeOptionText: { fontSize: 15, fontWeight: '600' as const, },
  biometricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, },
  biometricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  biometricIconWrap: { width: 36, height: 36, borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  biometricSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addUserBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, },
  addUserBtnText: { color: '#FFFFFF', fontWeight: '600' as const, fontSize: 15, },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, },
  userRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userRowAvatar: { width: 36, height: 36, borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userRowName: { fontSize: 16, fontWeight: '500' as const, letterSpacing: -0.2, },
  userRowUsername: { fontSize: 13, marginTop: 2, },
  userRowMeta: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 5,
  },
  userRolePill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, },
  rolePillText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  inactivePill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, },
  inactivePillText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  googlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  googlePillText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  userRowActions: {
    flexDirection: 'row',
    gap: 6,
  },
  userActionBtn: { padding: 8, borderRadius: 999, },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    marginTop: 16,
  },
  statsGridCompact: {
    flexWrap: 'wrap',
  },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16, gap: 4, },
  statCardCompact: { minWidth: '30%' as const, },
  statIconWrap: { width: 36, height: 36, borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.8, fontVariant: ['tabular-nums'], },
  statLabel: { fontSize: 13, fontWeight: '400' as const, },
  totalAmountCard: { borderRadius: 20, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', },
  totalAmountLabel: { fontSize: 15, color: 'rgba(245,245,247,0.65)', marginBottom: 4, fontWeight: '500' as const, },
  totalAmountValue: { fontSize: 40, fontWeight: '700' as const, color: '#F5F5F7', letterSpacing: -1.2, fontVariant: ['tabular-nums'], },
  statusMoved: { marginTop: 12, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusList: {
    gap: 10,
    marginTop: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIndicator: { width: 30, height: 30, borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  statusLabel: { flex: 1, fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.2, },
  statusCountWrap: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, minWidth: 34, alignItems: 'center', },
  statusCount: { fontSize: 15, fontWeight: '600' as const, fontVariant: ['tabular-nums'], },
  noAdminNotice: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  noAdminText: {
    fontSize: 13,
    fontStyle: 'italic' as const,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, },
  menuIconWrap: { width: 36, height: 36, borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: { fontSize: 16, fontWeight: '500' as const, letterSpacing: -0.2, },
  menuItemDescription: { fontSize: 13, marginTop: 2, },
  footer: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: { fontSize: 13, fontWeight: '600' as const, },
  platformInfo: {
    marginTop: 14,
    borderRadius: 14,
    padding: 16,
  },
  platformText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  platformSubtext: {
    fontSize: 12,
    marginTop: 3,
  },
  footerSubtext: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: { borderRadius: 22, padding: 24, width: '100%' as any, maxWidth: 440, },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 21, fontWeight: '700' as const, letterSpacing: -0.4, },
  modalField: {
    marginBottom: 16,
  },
  modalLabel: { fontSize: 13, fontWeight: '500' as const, marginBottom: 6, },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, ...webInputReset, },
  roleSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  roleOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, },
  modalCancelBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999, borderWidth: 1, },
  modalCancelText: { fontSize: 15, fontWeight: '600' as const, },
  modalConfirmBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, },
  modalConfirmText: { fontSize: 15, fontWeight: '600' as const, color: '#FFFFFF', },
});
