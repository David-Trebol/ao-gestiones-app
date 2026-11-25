import React, { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Factory, Mail, MoreHorizontal, Phone, Plus, User, X } from 'lucide-react-native';
import { PageHeader, usePageLayout } from '@/components/Page';
import Button from '@/components/Button';
import SearchField from '@/components/SearchField';
import SelectSheet from '@/components/SelectSheet';
import { canvas, panel, webInputReset } from '@/constants/theme';
import { enter, fx } from '@/constants/motion';
import { SUPPLIER_EVENT_SHORT, SUPPLIER_EVENT_TINT, SUPPLIER_STEPS, dmy, supplierSteps } from '@/constants/supplierLog';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import type { ThemeColors } from '@/constants/colors';
import type { OrderItem, Supplier } from '@/types';

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const TINT = '#7B5CC4';

type Form = { name: string; contact: string; phone: string; email: string; notes: string };
const EMPTY: Form = { name: '', contact: '', phone: '', email: '', notes: '' };

/**
 * Fabricantes: a quién se le compra cada producto. Se crean, editan y borran aquí, y en cada producto
 * del pedido se elige uno y se lleva su registro (pedido, recibido, pagado).
 */
export default function SuppliersScreen() {
  const router = useRouter();
  const { suppliers, orders, addSupplier, updateSupplier, deleteSupplier } = useData();
  const { colors, isDark } = useTheme();
  const { width, content, bottomSpace } = usePageLayout();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const grid = width >= 1024;
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<Supplier | null>(null);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  /** Productos de los pedidos (no cancelados) de cada fabricante */
  const lines = useMemo(() => {
    const m = new Map<string, { orderId: string; ref: string; client: string; item: OrderItem }[]>();
    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      for (const it of o.items) {
        if (!it.supplier_id) continue;
        const arr = m.get(it.supplier_id) ?? [];
        arr.push({ orderId: o.id, ref: o.reference_number, client: o.customer?.nombre_empresa || 'Sin cliente', item: it });
        m.set(it.supplier_id, arr);
      }
    }
    return m;
  }, [orders]);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return suppliers;
    return suppliers.filter(x => fold([x.name, x.contact, x.email, x.phone].filter(Boolean).join(' ')).includes(q));
  }, [suppliers, query]);

  const openNew = () => { setForm(EMPTY); setEditing('new'); };
  const openEdit = (x: Supplier) => {
    setForm({ name: x.name, contact: x.contact ?? '', phone: x.phone ?? '', email: x.email ?? '', notes: x.notes ?? '' });
    setEditing(x);
  };
  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Falta el nombre', 'Escribe el nombre del fabricante.'); return; }
    const fields = { name: form.name, contact: form.contact.trim() || null, phone: form.phone.trim() || null, email: form.email.trim() || null, notes: form.notes.trim() || null };
    setBusy(true);
    try {
      if (editing === 'new') await addSupplier(fields);
      else if (editing) await updateSupplier(editing.id, fields);
      setEditing(null);
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = (x: Supplier) => {
    const n = lines.get(x.id)?.length ?? 0;
    Alert.alert(
      '¿Eliminar fabricante?',
      n > 0 ? `«${x.name}» está en ${n} producto${n !== 1 ? 's' : ''}. Esos productos conservan el nombre y su registro.` : `Se eliminará «${x.name}».`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void deleteSupplier(x.id).catch(e => Alert.alert('No se pudo eliminar', (e as Error).message)) },
      ],
    );
  };

  const stat = (label: string, value: number, tint?: string) => (
    <View style={s.stat}>
      <Text style={[s.statValue, tint && value > 0 ? { color: tint } : null]}>{value}</Text>
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );

  const renderCard = (x: Supplier, i: number) => {
    const ls = lines.get(x.id) ?? [];
    const steps = ls.map(l => supplierSteps(l.item));
    const toReceive = steps.filter(st => !st.received).length;
    const toPay = steps.filter(st => !st.paid).length;
    const expanded = open === x.id;
    return (
      <View key={x.id} style={[s.card, panel(colors, isDark), grid && { width: '49%' as unknown as number }, enter(i, 'rise', { base: 120, step: 45 })]} testID={`supplier-card-${x.id}`}>
        <View style={s.cardTop}>
          <View style={[s.icon, { backgroundColor: TINT }]}><Factory size={18} color="#FFFFFF" strokeWidth={2.3} /></View>
          <Text style={s.name} numberOfLines={2}>{x.name}</Text>
          <Pressable onPress={() => setMenuFor(x)} style={s.menuBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Opciones de ${x.name}`} testID={`supplier-menu-${x.id}`}>
            <MoreHorizontal size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        {(!!x.contact || !!x.phone || !!x.email) && (
          <View style={s.contact}>
            {!!x.contact && <View style={s.line}><User size={14} color={colors.accent} /><Text style={s.sub} numberOfLines={1}>{x.contact}</Text></View>}
            {!!x.phone && (
              <Pressable style={s.line} onPress={() => void Linking.openURL(`tel:${x.phone!.replace(/\s/g, '')}`)} accessibilityRole="link">
                <Phone size={14} color={colors.accent} /><Text style={s.sub} numberOfLines={1}>{x.phone}</Text>
              </Pressable>
            )}
            {!!x.email && (
              <Pressable style={s.line} onPress={() => void Linking.openURL(`mailto:${x.email}`)} accessibilityRole="link">
                <Mail size={14} color={colors.accent} /><Text style={[s.sub, { flexShrink: 1 }]} numberOfLines={1}>{x.email}</Text>
              </Pressable>
            )}
          </View>
        )}
        {!!x.notes && <Text style={s.notes} numberOfLines={3}>{x.notes}</Text>}
        <View style={s.stats}>
          {stat('Productos', ls.length)}
          {stat('Por recibir', toReceive, SUPPLIER_EVENT_TINT.received)}
          {stat('Por pagar', toPay, SUPPLIER_EVENT_TINT.paid)}
        </View>
        {ls.length > 0 && (
          <Pressable onPress={() => setOpen(expanded ? null : x.id)} style={s.toggle} accessibilityRole="button" testID={`supplier-toggle-${x.id}`}>
            <Text style={s.toggleText}>{expanded ? 'Ocultar productos' : 'Ver productos y registro'}</Text>
            {expanded ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
          </Pressable>
        )}
        {expanded && (
          <View style={s.lines}>
            {ls.map((l, k) => {
              const st = steps[k]!;
              return (
                <Pressable key={k} onPress={() => router.push(`/order-detail?orderId=${l.orderId}`)} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.lineRow, k > 0 && s.sep, hovered && { backgroundColor: colors.fill }]} accessibilityRole="link" {...fx('tint')}>
                  <Text style={s.lineTitle} numberOfLines={1}>{`${l.item.quantity}× ${l.item.product_name || 'Sin nombre'}`}</Text>
                  <Text style={s.lineSub} numberOfLines={1}>{`${l.ref} · ${l.client}`}</Text>
                  <View style={s.steps}>
                    {SUPPLIER_STEPS.map(t => (
                      <View key={t} style={[s.step, st[t] ? { backgroundColor: SUPPLIER_EVENT_TINT[t] + '22', borderColor: SUPPLIER_EVENT_TINT[t] + '66' } : { borderColor: colors.border }]}>
                        <View style={[s.stepDot, { backgroundColor: st[t] ? SUPPLIER_EVENT_TINT[t] : colors.border }]} />
                        <Text style={[s.stepText, { color: st[t] ? colors.text : colors.textTertiary }]} numberOfLines={1}>
                          {st[t] ? `${SUPPLIER_EVENT_SHORT[t]} ${dmy(st[t]!).slice(0, 5)}` : `Sin ${SUPPLIER_EVENT_SHORT[t].toLowerCase()}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const input = (key: keyof Form, label: string, placeholder: string, extra: object = {}) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, key === 'notes' && { height: 84, paddingTop: 12, textAlignVertical: 'top' }]}
        value={form[key]}
        onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        testID={`supplier-${key}-input`}
        {...extra}
      />
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: canvas(colors) }]}>
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={[content, { paddingBottom: bottomSpace }]} keyboardShouldPersistTaps="handled">
        <PageHeader
          title="Fabricantes"
          subtitle={`${suppliers.length} fabricante${suppliers.length !== 1 ? 's' : ''} · a quién se le compra cada producto`}
          actions={<Button label="Añadir" icon={Plus} variant="primary" onPress={openNew} accessibilityLabel="Añadir fabricante" testID="create-supplier-btn" />}
        />
        {suppliers.length === 0 ? (
          <View style={[s.empty, panel(colors, isDark)]}>
            <View style={[s.emptyIcon, { backgroundColor: TINT }]}><Factory size={32} color="#FFFFFF" /></View>
            <Text style={s.emptyTitle}>Aún no hay fabricantes</Text>
            <Text style={s.emptyText}>Añade a quién le compras los productos. Después, en cada pedido eliges el fabricante de cada producto y apuntas cuándo se le pidió, cuándo llegó y cuándo se le pagó.</Text>
            <View style={{ marginTop: 14 }}><Button label="Añadir fabricante" icon={Plus} variant="primary" onPress={openNew} /></View>
          </View>
        ) : (
          <>
            <SearchField value={query} onChangeText={setQuery} placeholder="Buscar fabricante por nombre, contacto o email" testID="search-suppliers" style={{ marginBottom: 14 }} />
            {shown.length === 0 ? (
              <View style={[s.empty, panel(colors, isDark)]}><Text style={s.emptyTitle}>Ningún fabricante coincide con «{query}»</Text></View>
            ) : (
              <View style={[s.list, grid && s.grid]}>{shown.map(renderCard)}</View>
            )}
          </>
        )}
      </ScrollView>

      <SelectSheet
        visible={!!menuFor}
        title={menuFor?.name ?? ''}
        options={[{ value: 'edit', label: 'Editar datos' }, { value: 'delete', label: 'Eliminar fabricante', destructive: true }]}
        onSelect={v => { const x = menuFor; if (!x) return; if (v === 'edit') openEdit(x); else remove(x); }}
        onClose={() => setMenuFor(null)}
      />

      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={[s.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.modal, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
            <View style={s.modalHead}>
              <View style={[s.icon, { backgroundColor: TINT }]}><Factory size={18} color="#FFFFFF" /></View>
              <Text style={s.modalTitle} accessibilityRole="header">{editing === 'new' ? 'Añadir fabricante' : 'Editar fabricante'}</Text>
              <Pressable onPress={() => setEditing(null)} style={s.menuBtn} accessibilityRole="button" accessibilityLabel="Cerrar"><X size={20} color={colors.textSecondary} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
              {input('name', 'Nombre *', 'Ej.: Suministros Pérez', { autoFocus: true })}
              {input('contact', 'Persona de contacto', 'Ej.: Pepe Pérez')}
              {input('phone', 'Teléfono', 'Ej.: 600 123 456', { keyboardType: 'phone-pad' })}
              {input('email', 'Email', 'Ej.: pedidos@proveedor.es', { keyboardType: 'email-address', autoCapitalize: 'none' })}
              {input('notes', 'Notas', 'Condiciones, forma de pago, plazos…', { multiline: true })}
            </ScrollView>
            <View style={s.actions}>
              <Pressable style={[s.btn, { backgroundColor: colors.fill }]} onPress={() => setEditing(null)} accessibilityRole="button"><Text style={[s.btnText, { color: colors.text }]}>Cancelar</Text></Pressable>
              <Pressable style={[s.btn, { backgroundColor: colors.primaryFill, opacity: busy ? 0.6 : 1 }]} onPress={() => void save()} disabled={busy} accessibilityRole="button" testID="supplier-save-btn">
                <Text style={[s.btnText, { color: colors.onPrimary }]}>{editing === 'new' ? 'Añadir' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, alignItems: 'center' },
    list: { gap: 14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
    card: { borderRadius: 18, padding: 16, gap: 12 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    name: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: c.text },
    menuBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    contact: { gap: 6 },
    line: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
    sub: { fontSize: 14, color: c.textSecondary },
    notes: { fontSize: 13.5, color: c.textSecondary, fontStyle: 'italic' },
    stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border, paddingTop: 12, gap: 8 },
    stat: { flex: 1, minWidth: 0, gap: 2 },
    statValue: { fontSize: 20, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: 12.5, fontWeight: '600', color: c.textSecondary },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36, ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}) },
    toggleText: { fontSize: 14, fontWeight: '700', color: c.primary },
    lines: { borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
    lineRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
    sep: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    lineTitle: { fontSize: 14.5, fontWeight: '700', color: c.text },
    lineSub: { fontSize: 12.5, color: c.textSecondary },
    steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, minHeight: 24, borderRadius: 999, borderWidth: 1 },
    stepDot: { width: 7, height: 7, borderRadius: 4 },
    stepText: { fontSize: 12, fontWeight: '600' },
    empty: { borderRadius: 18, padding: 28, alignItems: 'center', gap: 6 },
    emptyIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, textAlign: 'center' },
    emptyText: { fontSize: 14, color: c.textSecondary, textAlign: 'center', maxWidth: 460 },
    overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { width: '100%', maxWidth: 480, borderRadius: 20, padding: 20 },
    modalHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
    modalTitle: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: c.text },
    field: { marginTop: 14, gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    input: { borderRadius: 12, backgroundColor: c.fill, color: c.text, paddingHorizontal: 14, height: 46, fontSize: 16, ...webInputReset },
    actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    btn: { flex: 1, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '700' },
  });
