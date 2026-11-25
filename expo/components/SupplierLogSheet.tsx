import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Check, ChevronDown, Factory, Plus, Trash2, X } from 'lucide-react-native';
import DateField from '@/components/DateField';
import { webInputReset } from '@/constants/theme';
import { enter } from '@/constants/motion';
import {
  SUPPLIER_EVENT_ICON, SUPPLIER_EVENT_LABEL, SUPPLIER_EVENT_ORDER, SUPPLIER_EVENT_SHORT, SUPPLIER_EVENT_TINT, SUPPLIER_PENDING_TINT, SUPPLIER_STEPS, SUPPLIER_TINT,
  dmy, isPaymentPending, sortedLog, supplierSteps, todayISO,
} from '@/constants/supplierLog';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { generateId } from '@/utils/calculations';
import type { ThemeColors } from '@/constants/colors';
import type { Order, SupplierEventType } from '@/types';

interface Props {
  order: Order;
  /** índice del producto, o null si está cerrado */
  index: number | null;
  /** abre con la lista de fabricantes desplegada para elegir */
  pickSupplier?: boolean;
  onClose: () => void;
}

/**
 * Fabricante de un producto y su registro: qué se ha hecho con el fabricante y cuándo
 * (pedido, recibido, pagado u otra cosa). Cada apunte se queda guardado; no se sobrescribe.
 */
export default function SupplierLogSheet({ order, index, pickSupplier, onClose }: Props) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { suppliers, addSupplier, updateItemSupplier } = useData();
  const item = index !== null ? order.items[index] : undefined;
  const [type, setType] = useState<SupplierEventType>('ordered');
  const [date, setDate] = useState<string | null>(todayISO());
  const [note, setNote] = useState('');
  // lista de fabricantes desplegada dentro de la propia ventana
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // avisos dentro de la propia ventana (una alerta normal quedaría detrás)
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // al abrir otro producto: propone el siguiente trámite que falta
  useEffect(() => {
    if (index === null || !item) return;
    const st = supplierSteps(item);
    setType(SUPPLIER_STEPS.find(t => !st[t]) ?? 'other');
    setDate(todayISO());
    setNote('');
    setNewName(null);
    setPicker(!!pickSupplier || !item.supplier_name);
    setQ('');
    setMsg(null);
    setConfirmDel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, pickSupplier]);

  if (index === null || !item) return null;
  const steps = supplierSteps(item);
  const log = sortedLog(item.supplier_log);

  const run = async (fn: () => Promise<void>, errTitle: string) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); } catch (e) { setMsg(`${errTitle}: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const setSupplier = (id: string | null, name?: string) => {
    setPicker(false);
    return run(() => updateItemSupplier(order.id, index, { supplier_id: id ?? undefined, supplier_name: id ? name ?? suppliers.find(x => x.id === id)?.name ?? '' : undefined }), 'No se pudo cambiar el fabricante');
  };
  const createSupplier = () =>
    run(async () => {
      const created = await addSupplier({ name: newName ?? '', contact: null, phone: null, email: null, notes: null });
      await updateItemSupplier(order.id, index, { supplier_id: created.id, supplier_name: created.name });
      setNewName(null);
      setPicker(false);
    }, 'No se pudo añadir el fabricante');
  const addEntry = () => {
    if (!date) { setMsg('Elige la fecha del apunte.'); return; }
    if (type === 'other' && !note.trim()) { setMsg('Escribe qué se ha hecho en la nota.'); return; }
    const entry = { id: generateId(), type, date, ...(note.trim() ? { note: note.trim() } : {}), created_at: new Date().toISOString() };
    void run(async () => {
      await updateItemSupplier(order.id, index, { supplier_log: [...(item.supplier_log ?? []), entry] });
      setNote('');
      const next = { ...steps, ...(type !== 'other' ? { [type]: date } : {}) };
      setType(SUPPLIER_STEPS.find(t => !next[t]) ?? 'other');
    }, 'No se pudo guardar el apunte');
  };
  const removeEntry = (id: string) =>
    void run(async () => {
      await updateItemSupplier(order.id, index, { supplier_log: (item.supplier_log ?? []).filter(e => e.id !== id) });
      setConfirmDel(null);
    }, 'No se pudo borrar');

  const wide = width >= 640;
  const twoCol = width >= 900;
  const next = SUPPLIER_STEPS.find(t => !steps[t]) ?? null;
  const lastDone = [...SUPPLIER_STEPS].reverse().find(t => steps[t]);
  const payPend = isPaymentPending(item);
  const tone = payPend ? SUPPLIER_EVENT_TINT.payment_pending : lastDone ? SUPPLIER_EVENT_TINT[lastDone] : SUPPLIER_PENDING_TINT;
  const status = payPend
    ? 'Pendiente de pago'
    : !item.supplier_name && !lastDone
    ? 'Sin fabricante'
    : next === null ? 'Pedido, recibido y pagado'
    : next === 'ordered' ? 'Falta pedirlo al fabricante'
    : next === 'received' ? 'Pedido · falta recibirlo'
    : 'Recibido · falta pagarlo';

  const supplierField = (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>Fabricante</Text>
      {newName !== null ? (
        <View style={s.newRow}>
          <TextInput style={[s.input, { flex: 1, minWidth: 180 }]} value={newName} onChangeText={setNewName} placeholder="Nombre del fabricante nuevo" placeholderTextColor={colors.textTertiary} autoFocus onSubmitEditing={() => void createSupplier()} testID="new-supplier-input" />
          <Pressable style={[s.smallBtn, { backgroundColor: colors.primaryFill }]} onPress={() => void createSupplier()} disabled={busy} accessibilityRole="button" testID="new-supplier-save">
            <Text style={[s.smallBtnText, { color: colors.onPrimary }]}>Añadir</Text>
          </Pressable>
          <Pressable style={[s.smallBtn, { backgroundColor: colors.fill }]} onPress={() => setNewName(null)} accessibilityRole="button">
            <Text style={[s.smallBtnText, { color: colors.text }]}>Cancelar</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable onPress={() => setPicker(v => !v)} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.select, { borderColor: picker || hovered || pressed ? SUPPLIER_TINT : colors.border, backgroundColor: colors.fill }]} accessibilityRole="button" accessibilityState={{ expanded: picker }} testID="supplier-picker">
            <View style={[s.selIcon, { backgroundColor: item.supplier_name ? SUPPLIER_TINT : colors.border }]}><Factory size={15} color="#FFFFFF" /></View>
            <Text style={[s.selectText, { color: item.supplier_name ? colors.text : colors.textTertiary }]} numberOfLines={1}>{item.supplier_name || 'Seleccionar fabricante'}</Text>
            <View style={{ transform: [{ rotate: picker ? '180deg' : '0deg' }] }}><ChevronDown size={18} color={colors.textSecondary} /></View>
          </Pressable>
          {picker && (
            <View style={[s.pickBox, { borderColor: SUPPLIER_TINT + '55', backgroundColor: SUPPLIER_TINT + (isDark ? '14' : '0A') }, enter(0, 'rise', { duration: 360 })]} testID="supplier-inline-list">
              {suppliers.length > 6 && (
                <TextInput style={[s.input, { height: 40, backgroundColor: colors.surface }]} value={q} onChangeText={setQ} placeholder="Buscar fabricante" placeholderTextColor={colors.textTertiary} testID="supplier-search" />
              )}
              <View style={s.pickWrap}>
                {suppliers.filter(x => !q.trim() || fold(x.name).includes(fold(q.trim()))).map((x, k) => {
                  const on = x.id === item.supplier_id;
                  return (
                    <Pressable key={x.id} onPress={() => void setSupplier(x.id)} disabled={busy} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.pickChip, on ? { backgroundColor: SUPPLIER_TINT, borderColor: SUPPLIER_TINT } : { backgroundColor: hovered || pressed ? colors.fill : colors.surface, borderColor: colors.border }, enter(k, 'pop', { base: 60, step: 25, duration: 380 })]} accessibilityRole="radio" accessibilityState={{ selected: on }} testID={`supplier-option-${x.id}`}>
                      {on && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                      <Text style={[s.pickText, { color: on ? '#FFFFFF' : colors.text }]} numberOfLines={1}>{x.name}</Text>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => setNewName('')} style={[s.pickChip, { borderColor: SUPPLIER_TINT, borderStyle: 'dashed', backgroundColor: 'transparent' }]} accessibilityRole="button" testID="supplier-new">
                  <Plus size={14} color={SUPPLIER_TINT} />
                  <Text style={[s.pickText, { color: SUPPLIER_TINT }]}>Nuevo fabricante</Text>
                </Pressable>
                {!!item.supplier_id && (
                  <Pressable onPress={() => void setSupplier(null)} style={[s.pickChip, { borderColor: colors.border, backgroundColor: 'transparent' }]} accessibilityRole="button" testID="supplier-remove">
                    <X size={14} color={colors.error} />
                    <Text style={[s.pickText, { color: colors.error }]}>Quitar</Text>
                  </Pressable>
                )}
              </View>
              {suppliers.length === 0 && <Text style={s.muted}>Aún no hay fabricantes. Añade el primero con «Nuevo fabricante».</Text>}
            </View>
          )}
        </>
      )}
    </View>
  );

  const stepBoxes = (
    <View style={s.steps}>
      {SUPPLIER_STEPS.map((t, k) => {
        const Icon = SUPPLIER_EVENT_ICON[t];
        const d = steps[t];
        const pp = t === 'paid' && payPend;
        const due = !d && t === next;
        const c = pp ? SUPPLIER_EVENT_TINT.payment_pending : d ? SUPPLIER_EVENT_TINT[t] : due ? SUPPLIER_PENDING_TINT : null;
        return (
          <View
            key={`${t}-${d ?? ''}`}
            style={[s.stepBox, c ? { backgroundColor: c + (d ? (isDark ? '33' : '1F') : '17'), borderColor: c + (d ? '8C' : '80') } : { borderColor: colors.border, borderStyle: 'dashed' }, enter(k, 'pop', { base: 120, step: 70, duration: 520 })]}
            testID={`supplier-step-${t}`}
          >
            <View style={s.stepTop}>
              <View style={[s.stepIcon, { backgroundColor: c ?? colors.fill }]}><Icon size={15} color={c ? '#FFFFFF' : colors.textTertiary} /></View>
              {d && !pp ? <Check size={16} color={c!} strokeWidth={3} /> : null}
            </View>
            <Text style={[s.stepLabel, { color: c ? colors.text : colors.textSecondary }]} numberOfLines={1}>{SUPPLIER_EVENT_SHORT[t]}</Text>
            <Text style={[s.stepDate, { color: pp ? (isDark ? '#FF8E9C' : '#C2283E') : d ? colors.text : due ? (isDark ? '#FFD54A' : '#7A5800') : colors.textTertiary }]} numberOfLines={1}>{pp ? 'Pendiente de pago' : d ? dmy(d) : due ? 'Toca ahora' : 'Pendiente'}</Text>
          </View>
        );
      })}
    </View>
  );

  const addForm = (
    <View style={[s.addBox, { borderColor: colors.border, backgroundColor: colors.fill }]}>
      <Text style={s.label}>Añadir al registro</Text>
      <View style={s.types}>
        {SUPPLIER_EVENT_ORDER.map(t => {
          const on = type === t;
          const Icon = SUPPLIER_EVENT_ICON[t];
          return (
            <Pressable key={t} onPress={() => setType(t)} style={[s.typeChip, on ? { backgroundColor: SUPPLIER_EVENT_TINT[t], borderColor: SUPPLIER_EVENT_TINT[t] } : { borderColor: colors.border, backgroundColor: colors.surface }]} accessibilityRole="radio" accessibilityState={{ selected: on }} testID={`supplier-type-${t}`}>
              <Icon size={14} color={on ? '#FFFFFF' : SUPPLIER_EVENT_TINT[t]} />
              <Text style={[s.typeText, { color: on ? '#FFFFFF' : colors.text }]}>{SUPPLIER_EVENT_LABEL[t]}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={s.formRow}>
        <View style={{ flex: 1, minWidth: 210 }}><DateField label="Fecha" value={date} onChange={setDate} /></View>
        <TextInput style={[s.input, { flex: 2, minWidth: 180, alignSelf: 'flex-end', backgroundColor: colors.surface }]} value={note} onChangeText={setNote} placeholder={type === 'other' ? 'Qué se ha hecho' : 'Nota (opcional): nº de pedido, importe…'} placeholderTextColor={colors.textTertiary} testID="supplier-note-input" />
      </View>
      {!!msg && <Text style={[s.msg, { color: colors.error }]} accessibilityRole="alert" testID="supplier-log-msg">{msg}</Text>}
      <Pressable style={[s.addBtn, { backgroundColor: SUPPLIER_EVENT_TINT[type], opacity: busy ? 0.6 : 1 }]} onPress={addEntry} disabled={busy} accessibilityRole="button" testID="supplier-add-entry">
        <Plus size={17} color="#FFFFFF" />
        <Text style={[s.smallBtnText, { color: '#FFFFFF' }]}>{`Apuntar «${SUPPLIER_EVENT_LABEL[type]}»`}</Text>
      </Pressable>
    </View>
  );

  const history = (
    <View style={{ gap: 8, flex: twoCol ? 1 : undefined }}>
      <Text style={s.label}>{log.length > 0 ? `Registro (${log.length})` : 'Registro'}</Text>
      {log.length === 0 ? (
        <View style={[s.empty, { borderColor: colors.border }]}>
          <Text style={s.muted}>Aún no hay apuntes. Apunta cuándo se pidió al fabricante, cuándo llegó y cuándo se le pagó.</Text>
        </View>
      ) : (
        <View style={s.timeline}>
          {log.map((e, k) => {
            const Icon = SUPPLIER_EVENT_ICON[e.type];
            return (
              <View key={e.id} style={[s.logRow, enter(k, 'slide', { base: 160, step: 50, duration: 480 })]} testID={`supplier-entry-${k}`}>
                <View style={s.rail}>
                  <View style={[s.stepIcon, { backgroundColor: SUPPLIER_EVENT_TINT[e.type] }]}><Icon size={14} color="#FFFFFF" /></View>
                  {k < log.length - 1 && <View style={[s.railLine, { backgroundColor: colors.border }]} />}
                </View>
                <View style={[s.logCard, { borderColor: SUPPLIER_EVENT_TINT[e.type] + '4D', backgroundColor: SUPPLIER_EVENT_TINT[e.type] + (isDark ? '1A' : '0D') }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.logTitle} numberOfLines={1}>{SUPPLIER_EVENT_LABEL[e.type]}</Text>
                    <Text style={[s.logDate, { color: SUPPLIER_EVENT_TINT[e.type] }]}>{dmy(e.date)}</Text>
                    {!!e.note && <Text style={s.muted}>{e.note}</Text>}
                  </View>
                  {confirmDel === e.id ? (
                    <View style={s.confirm}>
                      <Pressable onPress={() => removeEntry(e.id)} style={[s.confirmBtn, { backgroundColor: colors.error }]} accessibilityRole="button" testID={`supplier-entry-confirm-${k}`}>
                        <Text style={[s.confirmText, { color: '#FFFFFF' }]}>Borrar</Text>
                      </Pressable>
                      <Pressable onPress={() => setConfirmDel(null)} style={[s.confirmBtn, { backgroundColor: colors.fill }]} accessibilityRole="button">
                        <Text style={[s.confirmText, { color: colors.text }]}>No</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => setConfirmDel(e.id)} style={s.close} accessibilityRole="button" accessibilityLabel="Borrar apunte" testID={`supplier-entry-del-${k}`}>
                      <Trash2 size={16} color={colors.textTertiary} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.overlay, s.blur, { backgroundColor: colors.overlay }, !wide && { justifyContent: 'flex-end', padding: 0 }]}>
        <View style={[s.sheet, { backgroundColor: colors.surface, borderColor: colors.border }, twoCol && s.sheetWide, !wide && s.sheetMobile, s.shadow, enter(0, wide ? 'pop' : 'rise', { duration: 460 })]} accessibilityViewIsModal testID="supplier-log-sheet">
          <View style={[s.head, { backgroundColor: tone + (isDark ? '26' : '14'), borderColor: tone + '40' }]}>
            <View style={[s.icon, { backgroundColor: SUPPLIER_TINT }]}><Factory size={18} color="#FFFFFF" /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.title} accessibilityRole="header" numberOfLines={1}>Fabricante y registro</Text>
              <Text style={s.subtitle} numberOfLines={2}>{`${item.quantity}× ${item.product_name || 'Sin nombre'}`}</Text>
            </View>
            {wide && (
              <View style={[s.statusPill, { backgroundColor: tone }]}>
                <Text style={s.statusText} numberOfLines={1}>{status}</Text>
              </View>
            )}
            <Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Cerrar" testID="supplier-log-close"><X size={20} color={colors.textSecondary} /></Pressable>
          </View>
          {!wide && (
            <View style={[s.statusPill, { backgroundColor: tone, alignSelf: 'flex-start' }]}>
              <Text style={s.statusText} numberOfLines={1}>{status}</Text>
            </View>
          )}

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
            {twoCol ? (
              <View style={s.cols}>
                <View style={s.colMain}>{supplierField}{stepBoxes}{addForm}</View>
                <View style={[s.colSide, { borderColor: colors.border }]}>{history}</View>
              </View>
            ) : (
              <View style={{ gap: 18 }}>{supplierField}{stepBoxes}{addForm}{history}</View>
            )}
          </ScrollView>
        </View>
      </View>

    </Modal>
  );
}

const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    blur: Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px) saturate(140%)', WebkitBackdropFilter: 'blur(6px) saturate(140%)' } as object) : {},
    sheet: { width: '100%', maxWidth: 580, maxHeight: '92%', borderRadius: 22, padding: 16, gap: 14, borderWidth: StyleSheet.hairlineWidth },
    sheetWide: { maxWidth: 980 },
    sheetMobile: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 28 },
    shadow: Platform.OS === 'web' ? ({ boxShadow: '0 30px 80px rgba(0,0,0,0.28), 0 8px 24px rgba(0,0,0,0.12)' } as object) : {},
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderWidth: 1 },
    icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, color: c.text },
    subtitle: { fontSize: 14, color: c.textSecondary },
    statusPill: { minHeight: 30, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center', maxWidth: 260 },
    statusText: { fontSize: 13.5, fontWeight: '800', color: '#FFFFFF' },
    close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    cols: { flexDirection: 'row', gap: 20, alignItems: 'stretch' },
    colMain: { flex: 1.25, minWidth: 0, gap: 16 },
    colSide: { flex: 1, minWidth: 0, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 20 },
    label: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
    select: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transitionProperty: 'border-color', transitionDuration: '160ms' } as object) : {}) },
    selIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    selectText: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '700' },
    pickBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
    pickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, maxWidth: '100%', paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '160ms' } as object) : {}) },
    pickText: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
    newRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    input: { borderRadius: 12, backgroundColor: c.fill, color: c.text, paddingHorizontal: 14, height: 46, fontSize: 16, minWidth: 0, ...webInputReset },
    smallBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    smallBtnText: { fontSize: 15, fontWeight: '700' },
    steps: { flexDirection: 'row', gap: 8 },
    stepBox: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1.5, padding: 10, gap: 3 },
    stepTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
    stepIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    stepLabel: { fontSize: 14, fontWeight: '800' },
    stepDate: { fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
    addBox: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
    types: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object) : {}) },
    typeText: { fontSize: 14, fontWeight: '700' },
    formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, borderRadius: 999 },
    empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 14 },
    timeline: { gap: 0 },
    logRow: { flexDirection: 'row', gap: 10 },
    rail: { alignItems: 'center', width: 30 },
    railLine: { width: 2, flex: 1, marginVertical: 3, borderRadius: 1 },
    logCard: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
    logTitle: { fontSize: 14.5, fontWeight: '800', color: c.text },
    logDate: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
    muted: { fontSize: 13.5, color: c.textSecondary },
    msg: { fontSize: 14, fontWeight: '600' },
    confirm: { flexDirection: 'row', gap: 6 },
    confirmBtn: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    confirmText: { fontSize: 13.5, fontWeight: '700' },
  });
