/**
 * Lógica de la revisión: qué se propone aplicar al formulario y cómo se aplica.
 * Nada se escribe en el formulario sin que el usuario lo confirme.
 */
import type { Customer, Order, OrderFormData, OrderFormItem, ShippingFormItem } from '@/types';
import { FieldStatus, ParsedDoc, ParsedLine, Party } from './types';

export type CustomerKey = keyof Customer;

export interface ReviewField {
  key: CustomerKey;
  label: string;
  group: 'cliente' | 'referencias';
  value: string;
  status: FieldStatus | 'missing';
  source?: string;
  page?: number;
  note?: string;
  current: string;
  apply: boolean;
}

export interface ReviewLine {
  apply: boolean;
  shipping: boolean;
  code?: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  discount: number | null;
  amount: number | null;
  vat: number | null;
  check: ParsedLine['check'];
  note?: string;
  duplicate: boolean;
  page: number;
  source: string;
}

export interface ReviewState {
  customerSide: 'issuer' | 'recipient';
  fields: ReviewField[];
  lines: ReviewLine[];
  linesMode: 'replace' | 'append';
  priceAs: 'tpv' | 'costo';
  vatRate: string; // texto editable
  vatFromDoc: boolean;
  applyManufacturer: boolean;
}

const CLIENT_FIELDS: { key: CustomerKey; label: string }[] = [
  { key: 'nombre_empresa', label: 'Empresa' },
  { key: 'nif', label: 'NIF / CIF' },
  { key: 'contacto', label: 'Contacto' },
  { key: 'departamento', label: 'Departamento' },
  { key: 'direccion_1', label: 'Dirección' },
  { key: 'direccion_2', label: 'Dirección (2) · población' },
  { key: 'codigo_postal', label: 'Código postal' },
  { key: 'provincia', label: 'Provincia' },
  { key: 'pais', label: 'País' },
  { key: 'telefono_1', label: 'Teléfono' },
  { key: 'telefono_2', label: 'Teléfono 2' },
  { key: 'email', label: 'Email' },
];

const REF_FIELDS: { key: CustomerKey; label: string }[] = [
  { key: 'numero_referencia_pedido', label: 'Nº pedido del cliente' },
  { key: 'oferta_proforma', label: 'Oferta / proforma' },
  { key: 'numero_factura', label: 'Nº factura' },
  { key: 'numero_recibo', label: 'Nº albarán / recibo' },
  { key: 'condiciones_entrega', label: 'Condiciones de entrega' },
  { key: 'condiciones_pago', label: 'Condiciones de pago' },
];

function partyValue(p: Party, key: CustomerKey) {
  if (key === 'direccion_2') {
    const d2 = p.fields.direccion_2;
    const city = p.fields.poblacion;
    if (!d2 && !city) return undefined;
    const value = [d2?.value, city?.value].filter(Boolean).join(', ');
    const worst = [d2?.status, city?.status].includes('doubtful') ? 'doubtful' : 'ok';
    return {
      value,
      status: worst as FieldStatus,
      source: [d2?.source, city?.source].filter((s, i, a) => s && a.indexOf(s) === i).join(' · '),
      page: (d2 ?? city)!.page,
      note: city ? `La app no tiene campo "Población": se guarda aquí (${city.value}).` : d2?.note,
    };
  }
  return p.fields[key as keyof Party['fields']];
}

function makeField(key: CustomerKey, label: string, group: ReviewField['group'], src: { value: string; status: FieldStatus; source?: string; page?: number; note?: string } | undefined, current: string): ReviewField {
  const value = src?.value?.trim() ?? '';
  const cur = (current ?? '').trim();
  const same = !!value && norm(value) === norm(cur);
  return {
    key,
    label,
    group,
    value,
    status: value ? src!.status : 'missing',
    source: src?.source,
    page: src?.page,
    note: src?.note,
    current: cur,
    // Nunca se marca para sustituir un valor que ya hay en el formulario
    apply: !!value && !same && !cur,
  };
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9@.]/g, '');

export function buildFields(doc: ParsedDoc, side: 'issuer' | 'recipient', form: OrderFormData): ReviewField[] {
  const party = side === 'issuer' ? doc.issuer : doc.recipient;
  const c = form.customer;
  const fields: ReviewField[] = CLIENT_FIELDS.map(f => makeField(f.key, f.label, 'cliente', partyValue(party, f.key), c[f.key]));
  const refMap: Record<string, ParsedDoc['refs'][keyof ParsedDoc['refs']] | ParsedDoc['condiciones_pago']> = {
    numero_referencia_pedido: doc.refs.numero_pedido_cliente,
    oferta_proforma: doc.refs.oferta_proforma,
    numero_factura: doc.docType === 'factura' ? doc.refs.numero_factura ?? doc.refs.numero_documento : doc.refs.numero_factura,
    numero_recibo: doc.refs.numero_albaran ?? (doc.docType === 'albaran' ? doc.refs.numero_documento : undefined),
    condiciones_entrega: doc.condiciones_entrega,
    condiciones_pago: doc.condiciones_pago,
  };
  if (doc.docType === 'oferta' || doc.docType === 'proforma') {
    if (!refMap.oferta_proforma && doc.refs.numero_documento) refMap.oferta_proforma = doc.refs.numero_documento;
  }
  for (const f of REF_FIELDS) fields.push(makeField(f.key, f.label, 'referencias', refMap[f.key] as never, c[f.key]));
  return fields;
}

function isEmptyItem(i: OrderFormItem) {
  return !i.product_name.trim() && !i.tpv_unitario && !i.costo_unitario && !i.total_sin_iva;
}

export function buildReview(doc: ParsedDoc, form: OrderFormData, currentManufacturerId: string): ReviewState {
  const side = doc.customerIs;
  const formHasLines = form.items.some(i => !isEmptyItem(i));
  const vat = doc.totals.vatRate?.value ?? doc.lines.find(l => l.vat !== null)?.vat ?? null;
  return {
    customerSide: side,
    fields: buildFields(doc, side, form),
    lines: doc.lines.map(l => ({
      apply: l.duplicateOf === undefined && (l.amount !== null || l.unitPrice !== null),
      shipping: l.isShipping,
      code: l.code,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      amount: l.amount,
      vat: l.vat,
      check: l.check,
      note: l.note,
      duplicate: l.duplicateOf !== undefined,
      page: l.page,
      source: l.source,
    })),
    linesMode: formHasLines ? 'append' : 'replace',
    priceAs: 'tpv',
    vatRate: vat !== null ? String(vat).replace('.', ',') : '',
    vatFromDoc: vat !== null,
    applyManufacturer: !!doc.manufacturerMatch && doc.manufacturerMatch.id !== currentManufacturerId && !currentManufacturerId,
  };
}

/** Convierte una línea revisada en la línea del formulario (sin inventar valores). */
export function toFormItem(l: ReviewLine, priceAs: 'tpv' | 'costo', vat: number): OrderFormItem {
  const q = l.quantity ?? (l.unitPrice && l.amount ? Math.round((l.amount / l.unitPrice) * 1000) / 1000 : 1);
  const name = [l.code, l.description].filter(Boolean).join(' · ');
  const lineVat = l.vat ?? vat;
  if (l.unitPrice === null && l.amount !== null) {
    // Solo hay importe de línea: se guarda como total (ya neto, sin descuento adicional)
    return {
      product_name: name,
      quantity: q,
      costo_unitario: priceAs === 'costo' ? Math.round((l.amount / (q || 1)) * 10000) / 10000 : 0,
      tpv_unitario: 0,
      total_sin_iva: priceAs === 'tpv' ? l.amount : 0,
      descuento_porcentaje: 0,
      vat_percentage: lineVat,
    };
  }
  return {
    product_name: name,
    quantity: q,
    costo_unitario: priceAs === 'costo' ? (l.unitPrice ?? 0) * (1 - (l.discount ?? 0) / 100) : 0,
    tpv_unitario: priceAs === 'tpv' ? l.unitPrice ?? 0 : 0,
    total_sin_iva: 0,
    descuento_porcentaje: priceAs === 'tpv' ? l.discount ?? 0 : 0,
    vat_percentage: lineVat,
  };
}

export function toShippingItem(l: ReviewLine, vat: number): ShippingFormItem {
  const q = l.quantity ?? 1;
  const unit = l.unitPrice ?? (l.amount !== null ? l.amount / (q || 1) : 0);
  return {
    description: [l.code, l.description].filter(Boolean).join(' · '),
    quantity: q,
    costo_unitario: Math.round(unit * (1 - (l.discount ?? 0) / 100) * 100) / 100,
    total_sin_iva: l.amount ?? 0,
    vat_percentage: l.vat ?? vat,
  };
}

export function parseVat(text: string): number | null {
  const v = Number(text.replace('%', '').replace(',', '.').trim());
  return text.trim() && Number.isFinite(v) && v >= 0 && v < 100 ? v : null;
}

export function applyReview(form: OrderFormData, r: ReviewState, manufacturerId?: string): { form: OrderFormData; summary: string } {
  const customer = { ...form.customer };
  let nFields = 0;
  for (const f of r.fields) {
    if (f.apply && f.value.trim()) {
      customer[f.key] = f.value.trim();
      nFields++;
    }
  }
  const vat = parseVat(r.vatRate) ?? 21;
  const products = r.lines.filter(l => l.apply && !l.shipping).map(l => toFormItem(l, r.priceAs, vat));
  const ships = r.lines.filter(l => l.apply && l.shipping).map(l => toShippingItem(l, vat));
  let items = form.items;
  let shipping = form.shipping_items;
  if (products.length) {
    items = r.linesMode === 'replace' ? products : [...form.items.filter(i => !isEmptyItem(i)), ...products];
  }
  if (ships.length) shipping = r.linesMode === 'replace' ? ships : [...form.shipping_items, ...ships];
  const next: OrderFormData = { ...form, customer, items, shipping_items: shipping };
  if (r.applyManufacturer && manufacturerId) next.manufacturer_id = manufacturerId;
  const parts = [] as string[];
  if (nFields) parts.push(`${nFields} dato${nFields === 1 ? '' : 's'}`);
  if (products.length) parts.push(`${products.length} línea${products.length === 1 ? '' : 's'} de producto`);
  if (ships.length) parts.push(`${ships.length} gasto${ships.length === 1 ? '' : 's'} de envío`);
  return { form: next, summary: parts.length ? parts.join(', ') : 'nada' };
}

/** ¿Este documento ya se importó en otro pedido? (mismas referencias) */
export function findPossibleDuplicates(fields: ReviewField[], orders: Order[], excludeId?: string): string[] {
  const keys: CustomerKey[] = ['numero_referencia_pedido', 'numero_factura', 'oferta_proforma', 'numero_recibo'];
  const out: string[] = [];
  for (const k of keys) {
    const v = fields.find(f => f.key === k)?.value;
    if (!v || v.length < 3) continue;
    const hit = orders.find(o => o.id !== excludeId && norm(o.customer?.[k] ?? '') === norm(v));
    if (hit) out.push(`${fields.find(f => f.key === k)!.label} "${v}" ya está en el pedido ${hit.reference_number}${hit.customer?.nombre_empresa ? ` (${hit.customer.nombre_empresa})` : ''}.`);
  }
  return out;
}
