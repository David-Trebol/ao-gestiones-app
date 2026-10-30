import React, { useMemo, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { AlertTriangle, Check, ChevronDown, ChevronUp, FileText, Info, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { radius, space, webInputReset } from '@/constants/theme';
import type { Order, OrderFormData } from '@/types';
import { calculateItemTotals, formatCurrency } from '@/utils/calculations';
import { DOC_TYPE_LABEL_ES } from '@/utils/docread/labels';
import type { ParsedDoc, ReadResult } from '@/utils/docread/types';
import {
  ReviewField,
  ReviewLine,
  ReviewState,
  buildFields,
  findPossibleDuplicates,
  parseVat,
  toFormItem,
} from '@/utils/docread/review';

interface Props {
  visible: boolean;
  fileName: string;
  read: ReadResult;
  doc: ParsedDoc;
  form: OrderFormData;
  state: ReviewState;
  onChange: (s: ReviewState) => void;
  orders: Order[];
  editingOrderId?: string;
  manufacturerName?: string;
  onCancel: () => void;
  onApply: () => void;
}

const statusLabel = { ok: '', doubtful: 'Revisar', derived: 'Deducido', missing: 'No encontrado' } as const;

export default function DocumentReview(p: Props) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= 1024;
  const [tab, setTab] = useState<'datos' | 'documento'>('datos');
  const [showText, setShowText] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { state, doc, onChange } = p;

  const dupWarnings = useMemo(() => findPossibleDuplicates(state.fields, p.orders, p.editingOrderId), [state.fields, p.orders, p.editingOrderId]);
  const vat = parseVat(state.vatRate);
  const appliedFields = state.fields.filter(f => f.apply && f.value.trim()).length;
  const appliedLines = state.lines.filter(l => l.apply).length;
  const missing = state.fields.filter(f => f.group === 'cliente' && f.status === 'missing').map(f => f.label);
  const party = (side: 'issuer' | 'recipient') => (side === 'issuer' ? doc.issuer : doc.recipient);
  const partyName = (side: 'issuer' | 'recipient') => party(side).fields.nombre_empresa?.value || party(side).block[0] || '—';

  const setField = (i: number, patch: Partial<ReviewField>) => {
    const fields = state.fields.slice();
    fields[i] = { ...fields[i], ...patch };
    onChange({ ...state, fields });
  };
  const setLine = (i: number, patch: Partial<ReviewLine>) => {
    const lines = state.lines.slice();
    lines[i] = { ...lines[i], ...patch };
    onChange({ ...state, lines });
  };
  const switchSide = (side: 'issuer' | 'recipient') => {
    if (side === state.customerSide) return;
    const refs = state.fields.filter(f => f.group === 'referencias');
    const client = buildFields(doc, side, p.form).filter(f => f.group === 'cliente');
    onChange({ ...state, customerSide: side, fields: [...client, ...refs] });
  };
  const setAll = (group: ReviewField['group'], value: boolean) => {
    onChange({ ...state, fields: state.fields.map(f => (f.group === group && f.value ? { ...f, apply: value } : f)) });
  };

  const linesSum = state.lines.filter(l => l.apply && !l.shipping).reduce((acc, l) => acc + calculateItemTotals(toFormItem(l, 'tpv', vat ?? 21)).valor_sin_iva, 0);
  const shipSum = state.lines.filter(l => l.apply && l.shipping).reduce((acc, l) => acc + (l.amount ?? (l.unitPrice ?? 0) * (l.quantity ?? 1)), 0);

  const preview = (
    <ScrollView style={s.previewScroll} contentContainerStyle={s.previewContent}>
      {p.read.previews.map((src, i) => (
        <View key={i} style={s.pageWrap}>
          <Text style={s.pageLabel}>Página {i + 1}</Text>
          <Image source={{ uri: src }} style={[s.pageImg, { aspectRatio: aspect(p.read, i) }]} resizeMode="contain" accessibilityLabel={`Página ${i + 1} del documento`} />
        </View>
      ))}
      {!p.read.previews.length && <Text style={s.muted}>No hay vista previa disponible.</Text>}
    </ScrollView>
  );

  const fieldRow = (f: ReviewField, i: number) => {
    if (f.status === 'missing') return null;
    const conflict = !!f.current && f.current.toLowerCase() !== f.value.toLowerCase();
    const tone = f.status === 'doubtful' ? colors.warning : f.status === 'derived' ? colors.info : null;
    return (
      <View key={f.key} style={[s.fieldRow, tone && { borderLeftColor: tone, borderLeftWidth: 3 }]}>
        <Pressable
          onPress={() => setField(i, { apply: !f.apply })}
          style={s.checkHit}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: f.apply }}
          accessibilityLabel={`Aplicar ${f.label}`}
        >
          <View style={[s.check, f.apply && s.checkOn]}>{f.apply && <Check size={14} color="#fff" strokeWidth={3} />}</View>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.fieldHead}>
            <Text style={s.fieldLabel}>{f.label}</Text>
            {!!statusLabel[f.status] && (
              <View style={[s.pill, { backgroundColor: f.status === 'doubtful' ? colors.warningBg : colors.infoBg }]}>
                <Text style={[s.pillText, { color: f.status === 'doubtful' ? colors.warning : colors.info }]}>{statusLabel[f.status]}</Text>
              </View>
            )}
          </View>
          <TextInput
            value={f.value}
            onChangeText={t => setField(i, { value: t, apply: t.trim() ? f.apply || !f.current : false })}
            style={s.fieldInput}
            accessibilityLabel={f.label}
            keyboardType={f.key === 'email' ? 'email-address' : f.key.startsWith('telefono') ? 'phone-pad' : 'default'}
            autoCapitalize={f.key === 'email' ? 'none' : 'sentences'}
          />
          {!!f.note && <Text style={[s.note, tone && { color: tone }]}>{f.note}</Text>}
          {conflict && (
            <Text style={s.conflict}>
              En el formulario: «{f.current}». {f.apply ? 'Se sustituirá.' : 'Se mantiene (marca la casilla para sustituirlo).'}
            </Text>
          )}
          {showSources && !!f.source && (
            <Text style={s.source} numberOfLines={3}>
              Pág. {f.page} · «{f.source}»
            </Text>
          )}
        </View>
      </View>
    );
  };

  const lineRow = (l: ReviewLine, i: number) => {
    const appValue = l.shipping ? null : calculateItemTotals(toFormItem(l, 'tpv', vat ?? 21)).valor_sin_iva;
    const matches = l.amount !== null && appValue !== null && Math.abs(appValue - l.amount) <= Math.max(0.021, l.amount * 0.006);
    return (
      <View key={i} style={[s.lineRow, (l.check === 'mismatch' || l.duplicate) && { borderLeftColor: colors.warning, borderLeftWidth: 3 }]}>
        <Pressable onPress={() => setLine(i, { apply: !l.apply })} style={s.checkHit} accessibilityRole="checkbox" accessibilityState={{ checked: l.apply }} accessibilityLabel={`Importar línea ${i + 1}`}>
          <View style={[s.check, l.apply && s.checkOn]}>{l.apply && <Check size={14} color="#fff" strokeWidth={3} />}</View>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.fieldHead}>
            {!!l.code && <Text style={s.code}>{l.code}</Text>}
            {l.shipping && (
              <View style={[s.pill, { backgroundColor: colors.infoBg }]}>
                <Text style={[s.pillText, { color: colors.info }]}>Gasto de envío</Text>
              </View>
            )}
            {l.duplicate && (
              <View style={[s.pill, { backgroundColor: colors.warningBg }]}>
                <Text style={[s.pillText, { color: colors.warning }]}>Repetida</Text>
              </View>
            )}
          </View>
          <TextInput value={l.description} onChangeText={t => setLine(i, { description: t })} style={s.fieldInput} multiline accessibilityLabel={`Descripción línea ${i + 1}`} />
          <View style={s.numsRow}>
            <NumCell s={s} label="Cant." value={l.quantity} onChange={v => setLine(i, { quantity: v })} />
            <NumCell s={s} money label="Precio" value={l.unitPrice} onChange={v => setLine(i, { unitPrice: v })} />
            <NumCell s={s} label="Dto. %" value={l.discount} onChange={v => setLine(i, { discount: v })} />
            <NumCell s={s} money label="Importe doc." value={l.amount} onChange={v => setLine(i, { amount: v })} />
          </View>
          {appValue !== null && (
            <Text style={[s.note, { color: matches ? colors.success : l.amount === null ? colors.textSecondary : colors.warning }]}>
              {matches ? '✓ ' : ''}En la app: {formatCurrency(appValue)}
              {l.amount !== null && !matches ? ` · el documento dice ${formatCurrency(l.amount)}` : ''}
            </Text>
          )}
          {!!l.note && l.check !== 'ok' && <Text style={[s.note, { color: colors.warning }]}>{l.note}</Text>}
          {showSources && <Text style={s.source} numberOfLines={3}>Pág. {l.page} · «{l.source}»</Text>}
        </View>
      </View>
    );
  };

  const t = doc.totals;
  const data = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.dataContent, { paddingBottom: 120 + insets.bottom }]} keyboardShouldPersistTaps="handled">
      <View style={s.summaryCard}>
        <View style={s.fieldHead}>
          <FileText size={16} color={colors.primary} />
          <Text style={s.summaryTitle} numberOfLines={1}>{p.fileName}</Text>
        </View>
        <Text style={s.muted}>
          {DOC_TYPE_LABEL_ES[doc.docType]} · {p.read.pages.length} página{p.read.pages.length === 1 ? '' : 's'} ·{' '}
          {p.read.pages.every(pg => pg.method === 'pdf-text') ? 'texto del PDF (exacto)' : p.read.pages.some(pg => pg.method === 'pdf-text') ? 'texto del PDF + OCR' : 'reconocimiento de texto (OCR)'}
          {doc.refs.fecha ? ` · ${formatDate(doc.refs.fecha.value)}` : ''}
        </Text>
        <Text style={[s.muted, { marginTop: 4 }]}>Leído en tu navegador: el archivo no se ha enviado a ningún servicio.</Text>
      </View>

      {(dupWarnings.length > 0 || doc.warnings.length > 0 || p.read.notes.length > 0) && (
        <View style={s.warnCard}>
          {[...dupWarnings.map(w => `Posible documento ya importado: ${w}`), ...p.read.notes, ...doc.warnings].map((w, i) => (
            <View key={i} style={s.warnRow}>
              <AlertTriangle size={14} color={colors.warning} style={{ marginTop: 2 }} />
              <Text style={s.warnText}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={s.section}>¿Quién es el cliente?</Text>
      <View style={s.segment}>
        {(['issuer', 'recipient'] as const).map(side => (
          <Pressable
            key={side}
            onPress={() => switchSide(side)}
            style={[s.segBtn, state.customerSide === side && s.segOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: state.customerSide === side }}
            disabled={!party(side).block.length}
          >
            <Text style={[s.segLabel, state.customerSide === side && s.segLabelOn]}>{side === 'issuer' ? 'Emisor' : doc.recipient.label ? `Destinatario` : 'Destinatario'}</Text>
            <Text style={[s.segSub, state.customerSide === side && s.segLabelOn]} numberOfLines={1}>{party(side).block.length ? partyName(side) : 'No encontrado'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.reasonRow}>
        <Info size={13} color={doc.customerConfident ? colors.textSecondary : colors.warning} />
        <Text style={[s.muted, { flex: 1 }, !doc.customerConfident && { color: colors.warning }]}>{doc.customerReason}</Text>
      </View>
      {doc.manufacturerMatch && (
        <Pressable onPress={() => onChange({ ...state, applyManufacturer: !state.applyManufacturer })} style={s.inlineCheck} accessibilityRole="checkbox" accessibilityState={{ checked: state.applyManufacturer }}>
          <View style={[s.check, state.applyManufacturer && s.checkOn]}>{state.applyManufacturer && <Check size={14} color="#fff" strokeWidth={3} />}</View>
          <Text style={s.body}>
            Seleccionar el fabricante <Text style={{ fontWeight: '600' }}>{doc.manufacturerMatch.name}</Text>
            {p.manufacturerName ? ` (ahora: ${p.manufacturerName})` : ''}
          </Text>
        </Pressable>
      )}

      <View style={s.sectionRow}>
        <Text style={s.section}>Datos del cliente</Text>
        <Pressable onPress={() => setAll('cliente', !state.fields.some(f => f.group === 'cliente' && f.apply))} hitSlop={8}>
          <Text style={s.link}>{state.fields.some(f => f.group === 'cliente' && f.apply) ? 'Desmarcar todo' : 'Marcar todo'}</Text>
        </Pressable>
      </View>
      <View style={s.card}>{state.fields.map((f, i) => (f.group === 'cliente' ? fieldRow(f, i) : null))}</View>
      {missing.length > 0 && <Text style={[s.muted, s.padH]}>No aparecen en el documento: {missing.join(', ')}.</Text>}

      <View style={s.sectionRow}>
        <Text style={s.section}>Referencias y condiciones</Text>
      </View>
      <View style={s.card}>
        {state.fields.some(f => f.group === 'referencias' && f.status !== 'missing') ? (
          state.fields.map((f, i) => (f.group === 'referencias' ? fieldRow(f, i) : null))
        ) : (
          <Text style={[s.muted, { padding: space.lg }]}>No se han encontrado referencias.</Text>
        )}
      </View>

      <View style={s.sectionRow}>
        <Text style={s.section}>Líneas ({state.lines.length})</Text>
      </View>
      {state.lines.length > 0 ? (
        <>
          <View style={s.optionsCard}>
            <Text style={s.optLabel}>Los precios del documento son</Text>
            <View style={s.segment}>
              {(['tpv', 'costo'] as const).map(v => (
                <Pressable key={v} onPress={() => onChange({ ...state, priceAs: v })} style={[s.segBtn, state.priceAs === v && s.segOn]} accessibilityRole="radio" accessibilityState={{ selected: state.priceAs === v }}>
                  <Text style={[s.segLabel, state.priceAs === v && s.segLabelOn]}>{v === 'tpv' ? 'Precio de venta (TPV)' : 'Coste (fabricante)'}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.optLabel}>Las líneas importadas</Text>
            <View style={s.segment}>
              {(['replace', 'append'] as const).map(v => (
                <Pressable key={v} onPress={() => onChange({ ...state, linesMode: v })} style={[s.segBtn, state.linesMode === v && s.segOn]} accessibilityRole="radio" accessibilityState={{ selected: state.linesMode === v }}>
                  <Text style={[s.segLabel, state.linesMode === v && s.segLabelOn]}>{v === 'replace' ? 'Sustituyen a las actuales' : 'Se añaden a las actuales'}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.vatRow}>
              <Text style={[s.optLabel, { flex: 1 }]}>IVA para las líneas</Text>
              <TextInput value={state.vatRate} onChangeText={v => onChange({ ...state, vatRate: v })} placeholder="21" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" style={[s.fieldInput, { width: 72, textAlign: 'right' }]} accessibilityLabel="IVA en porcentaje" />
              <Text style={s.body}>%</Text>
            </View>
            <Text style={[s.note, !state.vatFromDoc && { color: colors.warning }]}>
              {state.vatFromDoc
                ? `Tomado del documento${t.vatRate?.status === 'derived' ? ' (calculado con la cuota de IVA y la base)' : ''}.`
                : 'El documento no indica el IVA: si lo dejas vacío se usará el 21 % habitual del formulario.'}
            </Text>
          </View>
          <View style={s.card}>{state.lines.map(lineRow)}</View>
        </>
      ) : (
        <Text style={[s.muted, s.padH]}>No se han encontrado líneas de productos.</Text>
      )}

      <Text style={s.section}>Comprobación de totales</Text>
      <View style={s.card}>
        <TotalRow s={s} label="Suma de líneas marcadas (como en la app)" value={linesSum + shipSum} />
        <TotalRow s={s} label="Base imponible del documento" value={t.base?.value} />
        <TotalRow s={s} label={`IVA del documento${t.vatRate ? ` (${t.vatRate.value} %)` : ''}`} value={t.vatAmount?.value} />
        <TotalRow s={s} label="Total del documento" value={t.total?.value} strong />
        {t.base && (
          <Text style={[s.note, { paddingHorizontal: space.lg, paddingBottom: space.md, color: Math.abs(linesSum + shipSum - t.base.value) <= 0.05 ? colors.success : colors.warning }]}>
            {Math.abs(linesSum + shipSum - t.base.value) <= 0.05 ? '✓ Las líneas cuadran con la base del documento.' : `Diferencia con la base: ${formatCurrency(t.base.value - linesSum - shipSum)}.`}
          </Text>
        )}
      </View>

      <Pressable onPress={() => setShowSources(v => !v)} style={s.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: showSources }}>
        <Text style={s.link}>{showSources ? 'Ocultar de dónde sale cada dato' : 'Ver de dónde sale cada dato'}</Text>
      </Pressable>
      <Pressable onPress={() => setShowText(v => !v)} style={s.toggleRow} accessibilityRole="button" accessibilityState={{ expanded: showText }}>
        <Text style={s.link}>Texto leído del documento</Text>
        {showText ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
      </Pressable>
      {showText && (
        <View style={[s.card, { padding: space.md }]}>
          <Text style={s.mono} selectable>
            {p.read.lines.map(l => `${l.page > 1 ? `[${l.page}] ` : ''}${l.text}`).join('\n')}
          </Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <Modal visible={p.visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={p.onCancel}>
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable onPress={p.onCancel} style={s.headerBtn} accessibilityRole="button" accessibilityLabel="Cancelar y cerrar">
            <X size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.headerTitle}>Revisar datos del documento</Text>
            <Text style={s.headerSub}>Nada se cambia hasta que pulses «Aplicar»</Text>
          </View>
          <View style={s.headerBtn} />
        </View>
        {!desktop && (
          <View style={[s.segment, { marginHorizontal: space.lg, marginBottom: space.sm }]}>
            {(['datos', 'documento'] as const).map(v => (
              <Pressable key={v} onPress={() => setTab(v)} style={[s.segBtn, tab === v && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === v }}>
                <Text style={[s.segLabel, tab === v && s.segLabelOn]}>{v === 'datos' ? 'Datos extraídos' : 'Documento'}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ flex: 1, flexDirection: desktop ? 'row' : 'column' }}>
          {desktop ? (
            <>
              <View style={s.previewPane}>{preview}</View>
              <View style={s.dataPane}>{data}</View>
            </>
          ) : tab === 'datos' ? (
            data
          ) : (
            preview
          )}
        </View>
        <View style={[s.footer, { paddingBottom: space.md + insets.bottom }]}>
          <Text style={[s.muted, { flex: 1 }]} numberOfLines={2}>
            {appliedFields} dato{appliedFields === 1 ? '' : 's'} · {appliedLines} línea{appliedLines === 1 ? '' : 's'}
          </Text>
          <Pressable onPress={p.onCancel} style={[s.btn, s.btnGhost]} accessibilityRole="button">
            <Text style={[s.btnText, { color: colors.text }]}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={p.onApply} style={[s.btn, s.btnPrimary, !appliedFields && !appliedLines && !state.applyManufacturer && { opacity: 0.5 }]} disabled={!appliedFields && !appliedLines && !state.applyManufacturer} accessibilityRole="button">
            <Text style={[s.btnText, { color: '#fff' }]}>Aplicar al formulario</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function aspect(read: ReadResult, i: number) {
  const pg = read.pages[i];
  if (!pg || !pg.width || !pg.height) return 0.707;
  // Las dimensiones ya son las de la página tal como se leyó (girada si hizo falta)
  return pg.width / pg.height;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function NumCell({ s, label, value, onChange, money }: { s: ReturnType<typeof makeStyles>; label: string; value: number | null; onChange: (v: number | null) => void; money?: boolean }) {
  const [text, setText] = useState(
    value === null ? '' : money ? value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : String(value).replace('.', ','),
  );
  return (
    <View style={s.numCell}>
      <Text style={s.numLabel}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={t => {
          setText(t);
          const n = Number(t.replace(/\./g, '').replace(',', '.'));
          onChange(t.trim() === '' ? null : Number.isFinite(n) ? n : value);
        }}
        keyboardType="decimal-pad"
        placeholder="—"
        style={s.numInput}
        accessibilityLabel={label}
      />
    </View>
  );
}

function TotalRow({ s, label, value, strong }: { s: ReturnType<typeof makeStyles>; label: string; value?: number; strong?: boolean }) {
  return (
    <View style={s.totalRow}>
      <Text style={[s.body, { flex: 1 }, strong && { fontWeight: '600' }]}>{label}</Text>
      <Text style={[s.body, strong && { fontWeight: '700' }, { fontVariant: ['tabular-nums'] }]}>{value === undefined ? 'No aparece' : formatCurrency(value)}</Text>
    </View>
  );
}

function makeStyles(c: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.md, backgroundColor: c.headerBackground, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    headerTitle: { fontSize: 16, fontWeight: '600', color: c.text, letterSpacing: -0.2 },
    headerSub: { fontSize: 12, color: c.textSecondary, marginTop: 1 },
    previewPane: { flex: 1, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border, backgroundColor: isDark ? '#000' : '#E5E5EA' },
    dataPane: { width: 560, maxWidth: '50%' as unknown as number },
    previewScroll: { flex: 1 },
    previewContent: { padding: space.lg, gap: space.lg, alignItems: 'center' },
    pageWrap: { width: '100%', maxWidth: 900 },
    pageLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 6 },
    pageImg: { width: '100%', backgroundColor: '#fff', borderRadius: 6 },
    dataContent: { padding: space.lg, gap: space.sm },
    summaryCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg },
    summaryTitle: { fontSize: 15, fontWeight: '600', color: c.text, flex: 1 },
    warnCard: { backgroundColor: c.warningBg, borderRadius: radius.lg, padding: space.md, gap: 6, borderWidth: 1, borderColor: c.warningBorder },
    warnRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    warnText: { flex: 1, fontSize: 13, lineHeight: 18, color: c.text },
    section: { fontSize: 13, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: space.lg, marginBottom: 2, paddingHorizontal: 4 },
    sectionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    link: { fontSize: 14, color: c.primary, fontWeight: '500' },
    card: { backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' },
    optionsCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm, marginBottom: space.sm },
    optLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '500' },
    vatRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    fieldRow: { flexDirection: 'row', gap: space.sm, paddingVertical: space.md, paddingRight: space.lg, paddingLeft: space.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider, borderLeftWidth: 3, borderLeftColor: 'transparent' },
    lineRow: { flexDirection: 'row', gap: space.sm, paddingVertical: space.md, paddingRight: space.md, paddingLeft: space.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider, borderLeftWidth: 3, borderLeftColor: 'transparent' },
    checkHit: { width: 40, alignItems: 'center', paddingTop: 2, minHeight: 44 },
    check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.textTertiary, alignItems: 'center', justifyContent: 'center' },
    checkOn: { backgroundColor: c.primary, borderColor: c.primary },
    inlineCheck: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.md, marginTop: space.sm, minHeight: 44 },
    fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
    fieldLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '500' },
    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
    pillText: { fontSize: 11, fontWeight: '600' },
    fieldInput: { fontSize: 15, color: c.text, backgroundColor: c.fill, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, minHeight: 40, ...webInputReset },
    note: { fontSize: 12, lineHeight: 16, color: c.textSecondary, marginTop: 4 },
    conflict: { fontSize: 12, lineHeight: 16, color: c.text, marginTop: 4, fontWeight: '500' },
    source: { fontSize: 12, lineHeight: 16, color: c.textTertiary, marginTop: 4, fontStyle: 'italic' },
    code: { fontSize: 12, fontWeight: '600', color: c.text, backgroundColor: c.fill, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
    numsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
    numCell: { flexGrow: 1, flexBasis: '22%', minWidth: 60 },
    numLabel: { fontSize: 11, color: c.textSecondary, marginBottom: 2 },
    numInput: { fontSize: 15, color: c.text, backgroundColor: c.fill, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 7, minHeight: 38, textAlign: 'right', fontVariant: ['tabular-nums'], ...webInputReset },
    segment: { flexDirection: 'row', backgroundColor: c.fill, borderRadius: 10, padding: 2, gap: 2 },
    segBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
    segOn: { backgroundColor: c.surface, ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } as object) : { elevation: 1 }) },
    segLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary, textAlign: 'center' },
    segSub: { fontSize: 12, color: c.textSecondary, marginTop: 1, maxWidth: '100%' },
    segLabelOn: { color: c.text },
    reasonRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingHorizontal: 4, marginTop: 6 },
    totalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider, gap: space.md },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.md, paddingHorizontal: 4, minHeight: 44 },
    mono: { fontSize: 12, lineHeight: 17, color: c.text, fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: undefined }) },
    muted: { fontSize: 13, lineHeight: 18, color: c.textSecondary },
    body: { fontSize: 15, color: c.text },
    padH: { paddingHorizontal: 4, marginTop: 4 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.headerBackground },
    btn: { paddingHorizontal: space.lg, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    btnGhost: { backgroundColor: c.fill },
    btnPrimary: { backgroundColor: c.primary },
    btnText: { fontSize: 15, fontWeight: '600' },
  });
}
