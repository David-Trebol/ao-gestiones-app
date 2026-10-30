import type { Order, OrderStatus } from '@/types';

export type SortKey = 'created_desc' | 'created_asc' | 'updated_desc' | 'amount_desc' | 'amount_asc';
export type PeriodKey = 'all' | '7' | '30' | '90' | 'year';

export interface OrderFilters {
  query: string;
  status: OrderStatus | 'all' | 'attention';
  manufacturerId: string; // '' = todos
  year: string; // '' = todos
  period: PeriodKey;
  sort: SortKey;
}

export const DEFAULT_FILTERS: OrderFilters = { query: '', status: 'all', manufacturerId: '', year: '', period: 'all', sort: 'created_desc' };

export const SORT_LABELS: Record<SortKey, string> = {
  created_desc: 'Más recientes',
  created_asc: 'Más antiguos',
  updated_desc: 'Última actualización',
  amount_desc: 'Importe: mayor primero',
  amount_asc: 'Importe: menor primero',
};

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  all: 'Cualquier fecha',
  '7': 'Últimos 7 días',
  '30': 'Últimos 30 días',
  '90': 'Últimos 90 días',
  year: 'Este año natural',
};

const DAY = 86_400_000;

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Texto en el que se busca: referencias, cliente, contacto, NIF, email, documentos y productos. */
function haystack(o: Order): string {
  const c = o.customer ?? ({} as Order['customer']);
  return fold(
    [
      o.reference_number,
      o.custom_reference,
      o.manufacturer_name,
      o.manufacturer_code,
      c.nombre_empresa,
      c.contacto,
      c.nif,
      c.email,
      c.telefono_1,
      c.numero_referencia_pedido,
      c.oferta_proforma,
      c.numero_factura,
      c.numero_recibo,
      ...(o.items ?? []).map(i => i.product_name),
    ]
      .filter(Boolean)
      .join(' · '),
  );
}

// ------------------------------------------------------------------ atención
/**
 * Reglas fijas y explicables, basadas solo en datos que ya existen (estado y fechas).
 * No se inventan fechas previstas ni responsables.
 */
export const ATTENTION_RULES = {
  pendingDays: 7,
  activeDays: 14,
};

export function attentionReasons(o: Order, now = Date.now()): string[] {
  if (o.status === 'delivered' || o.status === 'cancelled') return [];
  const out: string[] = [];
  const idle = Math.floor((now - new Date(o.updated_at || o.created_at).getTime()) / DAY);
  if (o.status === 'pending' && idle > ATTENTION_RULES.pendingDays) out.push(`Pendiente sin cambios hace ${idle} días`);
  if ((o.status === 'processing' || o.status === 'shipped') && idle > ATTENTION_RULES.activeDays)
    out.push(`${o.status === 'processing' ? 'Procesando' : 'Enviado'} sin cambios hace ${idle} días`);
  if (!o.customer?.nombre_empresa?.trim()) out.push('Sin cliente');
  if (!(o.total_with_vat > 0)) out.push('Importe 0 €');
  return out;
}

export function filterOrders(orders: Order[], f: OrderFilters, now = Date.now()): Order[] {
  const q = fold(f.query.trim());
  const terms = q ? q.split(/\s+/) : [];
  const minDate =
    f.period === 'all' ? 0 : f.period === 'year' ? new Date(new Date(now).getFullYear(), 0, 1).getTime() : now - Number(f.period) * DAY;
  const out = orders.filter(o => {
    if (f.status === 'attention') {
      if (!attentionReasons(o, now).length) return false;
    } else if (f.status !== 'all' && o.status !== f.status) return false;
    if (f.manufacturerId && o.manufacturer_id !== f.manufacturerId) return false;
    if (f.year && String(o.year) !== f.year) return false;
    if (minDate && new Date(o.created_at).getTime() < minDate) return false;
    if (terms.length) {
      const h = haystack(o);
      if (!terms.every(t => h.includes(t))) return false;
    }
    return true;
  });
  return sortOrders(out, f.sort);
}

export function sortOrders(list: Order[], sort: SortKey): Order[] {
  const t = (s: string) => new Date(s).getTime() || 0;
  const arr = list.slice();
  switch (sort) {
    case 'created_asc':
      return arr.sort((a, b) => t(a.created_at) - t(b.created_at));
    case 'updated_desc':
      return arr.sort((a, b) => t(b.updated_at) - t(a.updated_at));
    case 'amount_desc':
      return arr.sort((a, b) => b.total_with_vat - a.total_with_vat);
    case 'amount_asc':
      return arr.sort((a, b) => a.total_with_vat - b.total_with_vat);
    default:
      return arr.sort((a, b) => t(b.created_at) - t(a.created_at));
  }
}

export function activeFilterCount(f: OrderFilters): number {
  return [f.status !== 'all', !!f.manufacturerId, !!f.year, f.period !== 'all', !!f.query.trim()].filter(Boolean).length;
}
