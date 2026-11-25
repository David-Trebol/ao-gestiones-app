import { CircleDollarSign, Hourglass, PackageCheck, ShoppingCart, StickyNote } from 'lucide-react-native';
import type { Order, OrderItem, SupplierEvent, SupplierEventType } from '@/types';

/**
 * Registro con el fabricante de cada producto: se va apuntando qué se hace y cuándo
 * (pedido al fabricante, recibido, pagado u otra cosa), sin borrar lo anterior.
 */
export const SUPPLIER_EVENT_ORDER: SupplierEventType[] = ['ordered', 'received', 'payment_pending', 'paid', 'other'];

export const SUPPLIER_EVENT_LABEL: Record<SupplierEventType, string> = {
  ordered: 'Pedido al fabricante',
  received: 'Recibido',
  payment_pending: 'Pendiente de pago',
  paid: 'Pagado',
  other: 'Otro',
};

/** Nombre corto para chapas pequeñas */
export const SUPPLIER_EVENT_SHORT: Record<SupplierEventType, string> = {
  ordered: 'Pedido',
  received: 'Recibido',
  payment_pending: 'Pago pend.',
  paid: 'Pagado',
  other: 'Nota',
};

/** Colores de los trámites: pedido azul, recibido verde, pagado naranja; lo que falta, amarillo */
export const SUPPLIER_EVENT_TINT: Record<SupplierEventType, string> = {
  ordered: '#2F6FED',
  received: '#22A447',
  payment_pending: '#EF5468',
  paid: '#F27A0F',
  other: '#8E8E93',
};
/** Trámite pendiente (el siguiente que toca hacer) */
export const SUPPLIER_PENDING_TINT = '#E0A800';
/** Color de la sección «Fabricantes» */
export const SUPPLIER_TINT = '#0F8B8D';

export const SUPPLIER_EVENT_ICON = {
  ordered: ShoppingCart,
  received: PackageCheck,
  payment_pending: Hourglass,
  paid: CircleDollarSign,
  other: StickyNote,
} as const;

/** Los tres trámites que se siguen con cada producto */
export const SUPPLIER_STEPS: ('ordered' | 'received' | 'paid')[] = ['ordered', 'received', 'paid'];

/** Apuntes ordenados del más reciente al más antiguo */
export function sortedLog(log: SupplierEvent[] | undefined): SupplierEvent[] {
  return [...(log ?? [])].sort((a, b) => (b.date === a.date ? (b.created_at ?? '').localeCompare(a.created_at ?? '') : b.date.localeCompare(a.date)));
}

/** Última fecha de cada trámite (pedido, recibido, pagado), o null si aún no se ha hecho */
export function supplierSteps(item: Pick<OrderItem, 'supplier_log'>): Record<'ordered' | 'received' | 'paid', string | null> {
  const r: Record<'ordered' | 'received' | 'paid', string | null> = { ordered: null, received: null, paid: null };
  for (const e of item.supplier_log ?? []) {
    if (e.type !== 'ordered' && e.type !== 'received' && e.type !== 'paid') continue;
    if (!r[e.type] || e.date > r[e.type]!) r[e.type] = e.date;
  }
  return r;
}

/** Siguiente trámite que falta (pedido → recibido → pagado), o null si están todos */
export function nextSupplierStep(item: Pick<OrderItem, 'supplier_log'>): 'ordered' | 'received' | 'paid' | null {
  const st = supplierSteps(item);
  return SUPPLIER_STEPS.find(t => !st[t]) ?? null;
}

/** Fabricantes distintos de los productos de un pedido, en orden de aparición */
export function orderSupplierNames(items: OrderItem[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    const n = it.supplier_name?.trim();
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Fecha AAAA-MM-DD → DD/MM/AAAA */
export const dmy = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso);

/** Hoy en AAAA-MM-DD (hora local) */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * ¿Está el producto pendiente de pago? Sí, si tiene un apunte «Pendiente de pago»
 * y no hay un «Pagado» con la misma fecha o posterior.
 */
export function isPaymentPending(item: Pick<OrderItem, 'supplier_log'>): boolean {
  let pend: string | null = null;
  let paid: string | null = null;
  for (const e of item.supplier_log ?? []) {
    if (e.type === 'payment_pending' && (!pend || e.date > pend)) pend = e.date;
    if (e.type === 'paid' && (!paid || e.date > paid)) paid = e.date;
  }
  return !!pend && (!paid || paid < pend);
}

export interface Incident {
  index: number;
  product: string;
  text: string;
}

/** Incidencias por resolver de un pedido (de momento: productos pendientes de pago al fabricante) */
export function orderIncidents(o: Pick<Order, 'items'>): Incident[] {
  const out: Incident[] = [];
  (o.items ?? []).forEach((it, index) => {
    if (isPaymentPending(it)) {
      out.push({ index, product: it.product_name?.trim() || 'Producto sin nombre', text: `Pendiente de pago${it.supplier_name ? ` a ${it.supplier_name}` : ''}` });
    }
  });
  return out;
}
