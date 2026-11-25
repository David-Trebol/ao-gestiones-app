import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import {
  FolderOpen,
  Building2,
  FileText,
  Trash2,
  KeyRound,
  UserPlus,
  Shield,
  User,
  X,
  Moon,
  Sun,
  Fingerprint,
  ChevronRight,
  Download,
  Euro,
  LogOut,
} from 'lucide-react-native';
import { CompactTitleBar, PageHeader, useCollapsingTitle, usePageLayout } from '@/components/Page';
import { canvas, cardShadow, webInputReset } from '@/constants/theme';
import { exportOrdersToExcel } from '@/utils/exportExcel';
import { TintChip } from '@/components/AppNav';
import { SystemTint } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth, AppUser } from '@/contexts/AuthContext';
import { formatCurrency } from '@/utils/calculations';
import * as Haptics from 'expo-haptics';

export default function SettingsScreen() {
  const { orders, manufacturers, years, deleteAllData } = useData();
  const { currentUser, users, isAdmin, logout, addUser, updateUser, deleteUser, biometricEnabled, biometricAvailable, toggleBiometric, requestPasswordReset } = useAuth();
  const { colors, isDark, themeMode, setTheme } = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const { content, bottomSpace, width } = usePageLayout();
  // Ordenador: dos columnas (Apariencia, Cuenta y Datos | Resumen y Usuarios)
  const twoCols = width >= 1024;
  const { shown: compactShown, scrollProps } = useCollapsingTitle();

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
  // Facturación: sin los pedidos cancelados (decisión del propietario, 16/11/2026)
  const totalAmount = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.total_with_vat, 0);
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length;


  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [exporting, setExporting] = useState(false);

  /** Copia completa en Excel (hojas Pedidos, Líneas, Envíos y Fabricantes) */
  const handleExportAll = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const name = await exportOrdersToExcel(orders, manufacturers, 'copia-completa');
      Alert.alert('Copia descargada', `${name} · ${orders.length} pedido${orders.length === 1 ? '' : 's'}.`);
    } catch (e) {
      Alert.alert('No se pudo descargar la copia', (e as Error).message);
    } finally {
      setExporting(false);
    }
  }, [exporting, orders, manufacturers]);

  const openDeleteAll = useCallback(() => {
    setDeleteConfirm('');
    setDeleteOpen(true);
  }, []);

  const confirmDeleteAll = useCallback(async () => {
    if (deleteConfirm !== 'ELIMINAR') return;
    try {
      setDeleting(true);
      await deleteAllData();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setDeleteOpen(false);
      Alert.alert('Datos eliminados', 'La base de datos está vacía.');
    } catch (e) {
      Alert.alert('No se pudo eliminar', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirm, deleteAllData]);

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
      'Cerrar sesión',
      '¿Quieres salir de AO Gestiones?',
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


  const chevron = <ChevronRight size={18} color={colors.textTertiary} />;
  const row = (opts: { icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; tint: string; title: string; detail?: string; value?: string; onPress?: () => void; destructive?: boolean; testID?: string; first?: boolean; disabled?: boolean; trailing?: React.ReactNode }) => {
    const body = (
      <>
        <TintChip Icon={opts.icon} tint={opts.tint} size={30} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: opts.destructive ? colors.error : colors.text }]}>{opts.title}</Text>
          {!!opts.detail && <Text style={[styles.rowDetail, { color: colors.textSecondary }]}>{opts.detail}</Text>}
        </View>
        {!!opts.value && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{opts.value}</Text>}
        {opts.trailing}
        {opts.onPress && !opts.trailing && chevron}
      </>
    );
    const style = [styles.row, !opts.first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }];
    return opts.onPress ? (
      <Pressable
        onPress={opts.onPress}
        disabled={opts.disabled}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [...style, (pressed || hovered) && { backgroundColor: colors.fill }, opts.disabled && { opacity: 0.5 }]}
        accessibilityRole="button"
        testID={opts.testID}
      >
        {body}
      </Pressable>
    ) : (
      <View style={style} testID={opts.testID}>{body}</View>
    );
  };
  const group = (title: string | null, children: React.ReactNode, footer?: string) => (
    <View style={styles.group}>
      {!!title && <Text style={[styles.groupTitle, { color: colors.text }]} accessibilityRole="header">{title}</Text>}
      <View style={[styles.groupCard, { backgroundColor: colors.surface }, cardShadow(isDark)]}>{children}</View>
      {!!footer && <Text style={[styles.groupFooter, { color: colors.textSecondary }]}>{footer}</Text>}
    </View>
  );

  const stat = (label: string, value: string, Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>, tint: string, big?: boolean) => (
    <View style={[styles.statTile, big && styles.statTileBig, { backgroundColor: colors.surface }, cardShadow(isDark)]}>
      <View style={[styles.statStripe, { backgroundColor: tint }]} />
      <View style={[styles.statTop, !twoCols && !big && styles.statTopStacked]}>
        <View style={[styles.statIcon, { backgroundColor: tint }]}>
          <Icon size={17} color="#FFFFFF" strokeWidth={2.3} />
        </View>
        {/* Etiqueta y luego la cifra, en textos separados */}
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, big && styles.statValueBig, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );

  const profileCard = (
    <View style={[styles.profileCard, { backgroundColor: colors.nav }, !twoCols && styles.profileCardStacked]}>
      <View style={styles.profileLeft}>
        <View style={[styles.profileAvatarBrand, { backgroundColor: colors.brand }]}>
          <Text style={[styles.profileInitialBrand, { color: colors.onPrimary }]}>{(currentUser?.displayName || currentUser?.email || '?').slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.profileNameBrand, { color: colors.navText }]} numberOfLines={1}>{currentUser?.displayName}</Text>
          {!!currentUser?.email && <Text style={[styles.profileMeta, { color: colors.navMuted }]} numberOfLines={1}>{currentUser.email}</Text>}
          <View style={[styles.rolePill, { backgroundColor: colors.navActiveBg }]}>
            {isAdmin ? <Shield size={13} color={colors.navActiveText} /> : <User size={13} color={colors.navActiveText} />}
            <Text style={[styles.rolePillText, { color: colors.navActiveText }]}>{isAdmin ? 'Administrador' : 'Usuario'}</Text>
          </View>
        </View>
      </View>
      <Pressable
        onPress={handleLogout}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.logoutBrand, !twoCols && { alignSelf: 'stretch' }, { backgroundColor: hovered || pressed ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)' }]}
        accessibilityRole="button"
        testID="logout-btn"
      >
        <LogOut size={17} color={colors.navText} />
        <Text style={[styles.logoutBrandText, { color: colors.navText }]}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );

  const resumen = (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.text }]} accessibilityRole="header">Resumen</Text>
      <View style={styles.statGrid}>
        {stat('Pedidos', String(totalOrders), FileText, '#FF8718')}
        {stat('Referencias', String(totalManufacturers), Building2, '#3F6E92')}
        {stat('Años', String(totalYears), FolderOpen, '#5B6B73')}
        {stat('Facturación total', formatCurrency(totalAmount), Euro, SystemTint.green, true)}
      </View>
      <Text style={[styles.groupFooter, { color: colors.textSecondary }]}>
        {`Suma del total con IVA de los pedidos que no están cancelados${cancelledCount ? ` (no cuenta ${cancelledCount} cancelado${cancelledCount === 1 ? '' : 's'})` : ''}.`}
      </Text>
    </View>
  );

  const apariencia = group(
    'Apariencia',
    <>
      <View style={styles.row}>
        <TintChip Icon={isDark ? Moon : Sun} tint="#FF8718" size={30} />
        <Text style={[styles.rowTitle, styles.rowText, { color: colors.text }]}>Tema</Text>
        <View style={[styles.segment, { backgroundColor: colors.fill }]} accessibilityRole="tablist">
          {(['light', 'dark'] as const).map(m => (
            <Pressable
              key={m}
              onPress={() => handleSetTheme(m)}
              style={[styles.segBtn, themeMode === m && [styles.segOn, { backgroundColor: colors.primaryFill }]]}
              accessibilityRole="tab"
              accessibilityState={{ selected: themeMode === m }}
              testID={`theme-${m}`}
            >
              <Text style={[styles.segText, { color: themeMode === m ? colors.onPrimary : colors.text }]}>{m === 'light' ? 'Claro' : 'Oscuro'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {Platform.OS !== 'web' && biometricAvailable && row({
        icon: Fingerprint, tint: SystemTint.green, title: 'Acceso con huella', detail: 'Desbloquea la app con tu huella digital',
        trailing: <Switch value={biometricEnabled} onValueChange={handleToggleBiometric} trackColor={{ false: colors.border, true: SystemTint.green }} />,
      })}
    </>,
  );

  const usuarios = isAdmin
    ? group(
        'Usuarios',
        <>
          {users.map((user, i) => (
            <Pressable
              key={user.id}
              onPress={() => openEditUser(user)}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }, (pressed || hovered) && { backgroundColor: colors.fill }]}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${user.displayName}`}
              testID={`user-row-${user.id}`}
            >
              <View style={[styles.userAvatarSmall, { backgroundColor: user.role === 'admin' ? colors.brand : '#3F6E92' }]}>
                <Text style={[styles.userInitial, { color: user.role === 'admin' ? colors.onPrimary : '#FFFFFF' }]}>{(user.displayName || user.email || '?').slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>{user.displayName}</Text>
                <Text style={[styles.rowDetail, { color: colors.textSecondary }]} numberOfLines={1}>
                  {user.email} · {user.role === 'admin' ? 'Administrador' : 'Usuario'}{user.active ? '' : ' · Inactivo'}
                </Text>
              </View>
              {user.id !== currentUser?.id && (
                <Pressable onPress={() => handleDeleteUser(user)} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.iconBtn, hovered && { backgroundColor: colors.errorBg }]} accessibilityRole="button" accessibilityLabel={`Eliminar ${user.displayName}`}>
                  <Trash2 size={17} color={colors.error} />
                </Pressable>
              )}
              {chevron}
            </Pressable>
          ))}
          <Pressable
            onPress={openCreateUser}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.row, users.length > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }, (pressed || hovered) && { backgroundColor: colors.primarySoft }]}
            accessibilityRole="button"
            testID="add-user-btn"
          >
            <View style={[styles.userAvatarSmall, { backgroundColor: colors.primarySoftAlt }]}>
              <UserPlus size={16} color={colors.primary} />
            </View>
            <Text style={[styles.rowTitle, styles.rowText, { color: colors.primary, fontWeight: '600' }]}>Añadir usuario</Text>
          </Pressable>
        </>,
      )
    : null;

  const cuenta = group(
    'Cuenta',
    row({ icon: KeyRound, tint: '#5B6B73', title: 'Cambiar mi contraseña', detail: 'Te enviamos un enlace seguro por email', onPress: handleChangePassword, testID: 'change-password-btn', first: true }),
  );

  const datos = group(
    'Datos',
    <>
      {Platform.OS === 'web' && row({ icon: Download, tint: SystemTint.green, title: 'Descargar copia completa', detail: 'Excel con pedidos, líneas, envíos y fabricantes', onPress: () => void handleExportAll(), testID: 'export-all-btn', first: true, disabled: exporting || orders.length === 0 })}
      {isAdmin && row({ icon: Trash2, tint: SystemTint.red, title: 'Eliminar todos los datos', detail: 'Borra pedidos, referencias de pedido y años para todos los usuarios', onPress: openDeleteAll, destructive: true, testID: 'delete-all-btn', first: Platform.OS !== 'web', disabled: deleting })}
      {!isAdmin && Platform.OS !== 'web' && <Text style={[styles.rowDetail, { color: colors.textSecondary, padding: 16 }]}>Solo los administradores pueden borrar datos.</Text>}
    </>,
    isAdmin ? undefined : 'Solo los administradores pueden borrar datos o gestionar usuarios.',
  );

  return (
    <View style={[styles.outerContainer, { backgroundColor: canvas(colors) }]}>
      <CompactTitleBar title="Ajustes" shown={compactShown} />
      <ScrollView {...scrollProps} style={styles.container} contentContainerStyle={[content, styles.content, { paddingBottom: bottomSpace }]} showsVerticalScrollIndicator={false}>
        <PageHeader title="Ajustes" />
        {profileCard}
        {twoCols ? (
          <View style={styles.cols}>
            <View style={styles.colLeft}>
              {apariencia}
              {cuenta}
              {datos}
            </View>
            <View style={styles.colRight}>
              {resumen}
              {usuarios}
            </View>
          </View>
        ) : (
          <>
            {resumen}
            {apariencia}
            {usuarios}
            {cuenta}
            {datos}
          </>
        )}
      </ScrollView>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
            <View style={[styles.modalStripe, { backgroundColor: SystemTint.red }]} />
            <View style={styles.modalTitleRow}>
              <View style={[styles.statIcon, { backgroundColor: SystemTint.red }]}>
                <Trash2 size={17} color="#FFFFFF" strokeWidth={2.3} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>Eliminar todos los datos</Text>
            </View>
            <Text style={[styles.deleteText, { color: colors.text }]}>
              Se borrarán {orders.length} pedidos, {manufacturers.length} fabricantes y {years.length} años para todos los usuarios. No se puede deshacer.
            </Text>
            {Platform.OS === 'web' && orders.length > 0 && (
              <Pressable onPress={() => void handleExportAll()} disabled={exporting} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.deleteBackup, { backgroundColor: hovered ? colors.primarySoftAlt : colors.primarySoft }]} accessibilityRole="button" testID="delete-backup-btn">
                <Download size={17} color={colors.primary} />
                <Text style={[styles.deleteBackupText, { color: colors.primary }]}>{exporting ? 'Descargando…' : 'Descargar una copia antes (Excel)'}</Text>
              </Pressable>
            )}
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Escribe ELIMINAR para confirmar</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.fill, borderColor: deleteConfirm && deleteConfirm !== 'ELIMINAR' ? colors.error : 'transparent', color: colors.text }]}
              value={deleteConfirm}
              onChangeText={t => setDeleteConfirm(t.toUpperCase())}
              placeholder="ELIMINAR"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Escribe ELIMINAR para confirmar"
              testID="delete-confirm-input"
            />
            <View style={styles.deleteActions}>
              <Pressable onPress={() => setDeleteOpen(false)} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.deleteBtn, { backgroundColor: hovered ? colors.surfaceAlt : colors.fill }]} accessibilityRole="button" testID="delete-cancel-btn">
                <Text style={[styles.deleteBtnText, { color: colors.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmDeleteAll()}
                disabled={deleteConfirm !== 'ELIMINAR' || deleting}
                style={[styles.deleteBtn, { backgroundColor: SystemTint.red, opacity: deleteConfirm === 'ELIMINAR' && !deleting ? 1 : 0.4 }]}
                accessibilityRole="button"
                accessibilityState={{ disabled: deleteConfirm !== 'ELIMINAR' || deleting }}
                testID="delete-confirm-btn"
              >
                <Text style={[styles.deleteBtnText, { color: '#FFFFFF' }]}>{deleting ? 'Eliminando…' : 'Eliminar todo'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={userModalOpen} transparent animationType="fade" onRequestClose={() => setUserModalOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalStripe, { backgroundColor: colors.brand }]} />
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={[styles.statIcon, { backgroundColor: colors.brand }]}>
                  {editingUser ? <User size={17} color={colors.onPrimary} strokeWidth={2.3} /> : <UserPlus size={17} color={colors.onPrimary} strokeWidth={2.3} />}
                </View>
                <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>{editingUser ? 'Editar usuario' : 'Nuevo usuario'}</Text>
              </View>
              <Pressable onPress={() => setUserModalOpen(false)} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.iconBtn, hovered && { backgroundColor: colors.fill }]} accessibilityRole="button" accessibilityLabel="Cerrar">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Email *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.fill, borderColor: 'transparent', color: colors.text }]}
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
                style={[styles.modalInput, { backgroundColor: colors.fill, borderColor: 'transparent', color: colors.text }]}
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
                style={[styles.modalInput, { backgroundColor: colors.fill, borderColor: 'transparent', color: colors.text }]}
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
                  style={[styles.roleOption, { borderColor: formRole === 'admin' ? colors.primaryFill : colors.border, backgroundColor: formRole === 'admin' ? colors.primaryFill : colors.surface }]}
                  onPress={() => setFormRole('admin')}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: formRole === 'admin' }}
                >
                  <Shield size={14} color={formRole === 'admin' ? colors.onPrimary : colors.textSecondary} />
                  <Text style={[styles.roleOptionText, { color: formRole === 'admin' ? colors.onPrimary : colors.textSecondary }]}>Administrador</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleOption, { borderColor: formRole === 'user' ? colors.primaryFill : colors.border, backgroundColor: formRole === 'user' ? colors.primaryFill : colors.surface }]}
                  onPress={() => setFormRole('user')}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: formRole === 'user' }}
                >
                  <User size={14} color={formRole === 'user' ? colors.onPrimary : colors.textSecondary} />
                  <Text style={[styles.roleOptionText, { color: formRole === 'user' ? colors.onPrimary : colors.textSecondary }]}>Usuario</Text>
                </Pressable>
              </View>
            </View>

            {editingUser && (
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Cuenta activa</Text>
                <Switch
                  value={formActive}
                  onValueChange={setFormActive}
                  trackColor={{ false: colors.border, true: colors.primaryFill }}
                  thumbColor={formActive ? '#FFFFFF' : colors.textTertiary}
                />
              </View>
            )}

            <View style={[styles.modalActions, { borderTopColor: colors.divider }]}>
              <Pressable style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.modalCancelBtn, { borderColor: 'transparent', backgroundColor: hovered ? colors.surfaceAlt : colors.fill }]} onPress={() => setUserModalOpen(false)} accessibilityRole="button">
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.modalConfirmBtn, { backgroundColor: hovered ? colors.primaryDark : colors.primaryFill, opacity: savingUser ? 0.6 : 1 }]} onPress={handleSaveUser} disabled={savingUser} accessibilityRole="button" testID="user-form-save">
                <Text style={[styles.modalConfirmText, { color: colors.onPrimary }]}>{savingUser ? 'Guardando…' : editingUser ? 'Guardar cambios' : 'Crear usuario'}</Text>
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
    paddingBottom: 40,
  },
  cols: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  colLeft: { flex: 1, minWidth: 0 },
  colRight: { flex: 1.15, minWidth: 0 },
  profileCard: { borderRadius: 18, padding: 20, marginBottom: 28, flexDirection: 'row', alignItems: 'center', gap: 16, overflow: 'hidden' },
  profileCardStacked: { flexDirection: 'column', alignItems: 'stretch' },
  profileLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 },
  profileAvatarBrand: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  profileInitialBrand: { fontSize: 26, fontWeight: '800' as const },
  profileNameBrand: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4 },
  profileMeta: { fontSize: 14, marginTop: 2 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  rolePillText: { fontSize: 13, fontWeight: '700' as const },
  logoutBrand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, paddingHorizontal: 18, borderRadius: 999 },
  logoutBrandText: { fontSize: 15, fontWeight: '700' as const },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Pedidos, Fabricantes y Años en una fila de tres; la facturación ocupa la fila entera
  statTile: { flexGrow: 1, flexBasis: '30%' as unknown as number, minWidth: 96, borderRadius: 14, padding: 14, paddingTop: 16, gap: 10, overflow: 'hidden' },
  statTileBig: { flexBasis: '100%' as unknown as number },
  statStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // En móvil, icono encima de la etiqueta para que «Fabricantes» quepa en una tarjeta de un tercio
  statTopStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  statIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 14, fontWeight: '600' as const, flexShrink: 1 },
  statValue: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  statValueBig: { fontSize: 34 },
  userInitial: { fontSize: 14, fontWeight: '800' as const },
  modalStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 1 },
  userBanner: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 0,
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
  section: { borderRadius: 16, padding: 20, marginBottom: 18, borderWidth: 0,
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
  statIconWrap: { width: 34, height: 34, borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  menuIconWrap: { width: 30, height: 30, borderRadius: 8,
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
  group: { marginBottom: 28 },
  groupTitle: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.4, marginBottom: 8, paddingHorizontal: 4 },
  groupCard: { borderRadius: 14, overflow: 'hidden' },
  groupFooter: { fontSize: 13, lineHeight: 18, marginTop: 8, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, letterSpacing: -0.2 },
  rowDetail: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  rowValue: { fontSize: 16, fontVariant: ['tabular-nums'] },
  totalValue: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 28 },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  profileInitial: { fontSize: 24, fontWeight: '600' as const },
  profileName: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.4 },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 2, gap: 2 },
  segBtn: { minHeight: 32, paddingHorizontal: 16, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segOn: { ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 3px rgba(0,0,0,0.14)' } as object) : { elevation: 1 }) },
  segText: { fontSize: 14, fontWeight: '600' as const },
  userAvatarSmall: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  logoutRow: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 15, lineHeight: 21, marginBottom: 16 },
  deleteBackup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 12, marginBottom: 18 },
  deleteBackupText: { fontSize: 15, fontWeight: '600' as const },
  deleteActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  deleteBtn: { flex: 1, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 16, fontWeight: '600' as const },
});
