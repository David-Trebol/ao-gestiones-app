import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ChevronDown, Factory, Plus, Trash2, X } from 'lucide-react-native';
import DateField from '@/components/DateField';
import SelectSheet from '@/components/SelectSheet';
import { webInputReset } from '@/constants/theme';
import {
  SUPPLIER_EVENT_ICON, SUPPLIER_EVENT_LABEL, SUPPLIER_EVENT_ORDER, SUPPLIER_EVENT_SHORT, SUPPLIER_EVENT_TINT, SUPPLIER_STEPS,
  dmy, sortedLog, supplierSteps, todayISO,
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
  /** abre directamente el alta de un fabricante nuevo */
  startNew?: boolean;
  onClose: () => void;
}

/**
 * Fabricante de un producto y su registro: qué se ha hecho con el fabricante y cuándo
 * (pedido, recibido, pagado u otra cosa). Cada apunte se queda guardado; no se sobrescribe.
 */
export default function SupplierLogSheet({ order, index, startNew, onClose }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { suppliers, addSupplier, updateItemSupplier } = useData();
  const item = index !== null ? order.items[index] : undefined;
  const [type, setType] = useState<SupplierEventType>('ordered');
  const [date, setDate] = useState<string | null>(todayISO());
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState(false);
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
    setNewName(startNew ? '' : null);
    setMsg(null);
    setConfirmDel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, startNew]);

  if (index === null || !item) return null;
  const steps = supplierSteps(item);
  const log = sortedLog(item.supplier_log);

  const run = async (fn: () => Promise<void>, errTitle: string) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); } catch (e) { setMsg(`${errTitle}: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const setSupplier = (id: string | null, name?: string) =>
    run(() => updateItemSupplier(order.id, index, { supplier_id: id ?? undefined, supplier_name: id ? name ?? suppliers.find(x => x.id === id)?.name ?? '' : undefined }), 'No se pudo cambiar el fabricante');
  const createSupplier = () =>
    run(async () => {
      const created = await addSupplier({ name: newName ?? '', contact: null, phone: null, email: null, notes: null });
      await updateItemSupplier(order.id, index, { supplier_id: created.id, supplier_name: created.name });
      setNewName(null);
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
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.overlay, { backgroundColor: colors.overlay }, !wide && { justifyContent: 'flex-end', padding: 0 }]}>
        <View style={[s.sheet, { backgroundColor: colors.surface }, !wide && s.sheetMobile]} accessibilityViewIsModal testID="supplier-log-sheet">
          <View style={s.head}>
            <View style={[s.icon, { backgroundColor: '#7B5CC4' }]}><Factory size={18} color="#FFFFFF" /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.title} accessibilityRole="header" numberOfLines={1}>Fabricante y registro</Text>
              <Text style={s.subtitle} numberOfLines={1}>{`${item.quantity}× ${item.product_name || 'Sin nombre'}`}</Text>
            </View>
            <Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Cerrar" testID="supplier-log-close"><X size={20} color={colors.textSecondary} /></Pressable>
          </View>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 18, paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
            {/* Fabricante */}
            <View style={{ gap: 8 }}>
              <Text style={s.label}>Fabricante</Text>
              {newName !== null ? (
                <View style={s.newRow}>
                  <TextInput style={[s.input, { flex: 1 }]} value={newName} onChangeText={setNewName} placeholder="Nombre del fabricante nuevo" placeholderTextColor={colors.textTertiary} autoFocus onSubmitEditing={() => void createSupplier()} testID="new-supplier-input" />
                  <Pressable style={[s.smallBtn, { backgroundColor: colors.primaryFill }]} onPress={() => void createSupplier()} disabled={busy} accessibilityRole="button" testID="new-supplier-save">
                    <Text style={[s.smallBtnText, { color: colors.onPrimary }]}>Añadir</Text>
                  </Pressable>
                  <Pressable style={[s.smallBtn, { backgroundColor: colors.fill }]} onPress={() => setNewName(null)} accessibilityRole="button">
                    <Text style={[s.smallBtnText, { color: colors.text }]}>Cancelar</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setPicker(true)} style={[s.select, { borderColor: colors.border, backgroundColor: colors.fill }]} accessibilityRole="button" testID="supplier-picker">
                  <Text style={[s.selectText, { color: item.supplier_name ? colors.text : colors.textTertiary }]} numberOfLines={1}>{item.supplier_name || 'Seleccionar fabricante'}</Text>
                  <ChevronDown size={18} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>

            {/* Trámites */}
            <View style={s.steps}>
              {SUPPLIER_STEPS.map(t => {
                const Icon = SUPPLIER_EVENT_ICON[t];
                const d = steps[t];
                return (
                  <View key={t} style={[s.stepBox, d ? { backgroundColor: SUPPLIER_EVENT_TINT[t] + '1F', borderColor: SUPPLIER_EVENT_TINT[t] + '66' } : { borderColor: colors.border }]} testID={`supplier-step-${t}`}>
                    <View style={[s.stepIcon, { backgroundColor: d ? SUPPLIER_EVENT_TINT[t] : colors.fill }]}><Icon size={15} color={d ? '#FFFFFF' : colors.textTertiary} /></View>
                    <Text style={[s.stepLabel, { color: d ? colors.text : colors.textSecondary }]} numberOfLines={1}>{SUPPLIER_EVENT_SHORT[t]}</Text>
                    <Text style={[s.stepDate, { color: d ? colors.text : colors.textTertiary }]} numberOfLines={1}>{d ? dmy(d) : 'Pendiente'}</Text>
                  </View>
                );
              })}
            </View>

            {/* Nuevo apunte */}
            <View style={[s.addBox, { borderColor: colors.border }]}>
              <Text style={s.label}>Añadir al registro</Text>
              <View style={s.types}>
                {SUPPLIER_EVENT_ORDER.map(t => {
                  const on = type === t;
                  return (
                    <Pressable key={t} onPress={() => setType(t)} style={[s.typeChip, on ? { backgroundColor: SUPPLIER_EVENT_TINT[t], borderColor: SUPPLIER_EVENT_TINT[t] } : { borderColor: colors.border }]} accessibilityRole="radio" accessibilityState={{ selected: on }} testID={`supplier-type-${t}`}>
                      <Text style={[s.typeText, { color: on ? '#FFFFFF' : colors.text }]}>{SUPPLIER_EVENT_LABEL[t]}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <DateField label="Fecha" value={date} onChange={setDate} />
              <TextInput style={s.input} value={note} onChangeText={setNote} placeholder={type === 'other' ? 'Qué se ha hecho' : 'Nota (opcional): nº de pedido, importe, transportista…'} placeholderTextColor={colors.textTertiary} testID="supplier-note-input" />
              {!!msg && <Text style={[s.msg, { color: colors.error }]} accessibilityRole="alert" testID="supplier-log-msg">{msg}</Text>}
              <Pressable style={[s.addBtn, { backgroundColor: colors.primaryFill, opacity: busy ? 0.6 : 1 }]} onPress={addEntry} disabled={busy} accessibilityRole="button" testID="supplier-add-entry">
                <Plus size={17} color={colors.onPrimary} />
                <Text style={[s.smallBtnText, { color: colors.onPrimary }]}>Añadir apunte</Text>
              </Pressable>
            </View>

            {/* Registro */}
            <View style={{ gap: 8 }}>
              <Text style={s.label}>{log.length > 0 ? `Registro (${log.length})` : 'Registro'}</Text>
              {log.length === 0 ? (
                <Text style={s.muted}>Aún no hay apuntes. Apunta cuándo se pidió al fabricante, cuándo llegó y cuándo se le pagó.</Text>
              ) : (
                <View style={[s.log, { borderColor: colors.border }]}>
                  {log.map((e, k) => {
                    const Icon = SUPPLIER_EVENT_ICON[e.type];
                    return (
                      <View key={e.id} style={[s.logRow, k > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]} testID={`supplier-entry-${k}`}>
                        <View style={[s.stepIcon, { backgroundColor: SUPPLIER_EVENT_TINT[e.type] }]}><Icon size={14} color="#FFFFFF" /></View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.logTitle} numberOfLines={1}>{`${SUPPLIER_EVENT_LABEL[e.type]} · ${dmy(e.date)}`}</Text>
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
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      <SelectSheet
        visible={picker}
        title="Seleccionar fabricante"
        searchable={suppliers.length > 6}
        searchPlaceholder="Buscar fabricante"
        options={[
          ...suppliers.map(x => ({ value: x.id, label: x.name, hint: x.contact ?? undefined })),
          { value: '__new', label: '+ Añadir fabricante nuevo' },
          ...(item.supplier_id ? [{ value: '__none', label: 'Quitar fabricante', destructive: true }] : []),
        ]}
        selected={item.supplier_id}
        onSelect={v => {
          if (v === '__new') setNewName('');
          else if (v === '__none') void setSupplier(null);
          else void setSupplier(v);
        }}
        onClose={() => setPicker(false)}
      />
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    sheet: { width: '100%', maxWidth: 560, maxHeight: '92%', borderRadius: 20, padding: 18, gap: 14 },
    sheetMobile: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 28 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, color: c.text },
    subtitle: { fontSize: 14, color: c.textSecondary },
    close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
    select: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}) },
    selectText: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600' },
    newRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    input: { borderRadius: 12, backgroundColor: c.fill, color: c.text, paddingHorizontal: 14, height: 46, fontSize: 16, minWidth: 0, ...webInputReset },
    smallBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    smallBtnText: { fontSize: 15, fontWeight: '700' },
    steps: { flexDirection: 'row', gap: 8 },
    stepBox: { flex: 1, minWidth: 0, borderRadius: 14, borderWidth: 1, padding: 10, gap: 4 },
    stepIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    stepLabel: { fontSize: 13, fontWeight: '700' },
    stepDate: { fontSize: 13.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
    addBox: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
    types: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    typeChip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    typeText: { fontSize: 14, fontWeight: '700' },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, borderRadius: 999 },
    log: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
    logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
    logTitle: { fontSize: 14.5, fontWeight: '700', color: c.text },
    muted: { fontSize: 13.5, color: c.textSecondary },
    msg: { fontSize: 14, fontWeight: '600' },
    confirm: { flexDirection: 'row', gap: 6 },
    confirmBtn: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    confirmText: { fontSize: 13.5, fontWeight: '700' },
  });
