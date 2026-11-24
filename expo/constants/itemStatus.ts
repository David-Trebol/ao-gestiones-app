import type { ItemStatus, OrderItem } from '@/types';
import type { ThemeColors } from '@/constants/colors';

/**
 * Estado de cada producto de un pedido, con su color:
 * - Sin empezar: el color normal (no se ha hecho nada con él)
 * - Pendiente: amarillo (pedido al fabricante, a la espera)
 * - Enviado: verde
 * - Entregado: azul petróleo (ya lo tiene el cliente; distinto del verde para que se vean a la vez)
 * El amarillo es propio (no el naranja de la marca) para que no se confunda con los botones.
 */
export const ITEM_STATUS_ORDER: ItemStatus[] = ['none', 'pending', 'shipped', 'delivered'];

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  none: 'Sin empezar',
  pending: 'Pendiente',
  shipped: 'Enviado',
  delivered: 'Entregado',
};

export const ITEM_STATUS_HINT: Record<ItemStatus, string> = {
  none: 'Todavía no se ha hecho nada con este producto',
  pending: 'En marcha, a la espera de enviarse',
  shipped: 'Ya ha salido hacia el cliente',
  delivered: 'El cliente ya lo tiene',
};

export interface ItemTone { text: string; bg: string; border: string; dot: string; row: string }

export function itemTone(st: ItemStatus | undefined, c: ThemeColors, isDark: boolean): ItemTone {
  switch (st) {
    case 'delivered':
      return isDark
        ? { text: '#6CC9F0', bg: 'rgba(10,132,190,0.20)', border: 'rgba(80,180,230,0.42)', dot: '#3DB2E8', row: 'rgba(10,132,190,0.09)' }
        : { text: '#0B5F86', bg: 'rgba(10,126,180,0.13)', border: 'rgba(10,126,180,0.40)', dot: '#0A7EB4', row: 'rgba(10,126,180,0.07)' };
    case 'shipped':
      return { text: c.success, bg: c.successBg, border: c.successBorder, dot: isDark ? '#30D158' : '#22A447', row: isDark ? 'rgba(48,209,88,0.08)' : 'rgba(52,199,89,0.07)' };
    case 'pending':
      return isDark
        ? { text: '#FFD54A', bg: 'rgba(255,204,0,0.16)', border: 'rgba(255,204,0,0.38)', dot: '#FFCC00', row: 'rgba(255,204,0,0.07)' }
        : { text: '#7A5800', bg: 'rgba(255,204,0,0.22)', border: 'rgba(230,180,0,0.55)', dot: '#F2B705', row: 'rgba(255,204,0,0.09)' };
    default:
      return { text: c.textSecondary, bg: c.fill, border: c.border, dot: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,42,57,0.28)', row: 'transparent' };
  }
}

export const itemStatusOf = (it: Pick<OrderItem, 'item_status'>): ItemStatus => it.item_status ?? 'none';

/** Recuento de productos por estado */
export function itemProgress(items: OrderItem[]): { total: number; shipped: number; delivered: number; pending: number; none: number; out: number } {
  const r = { total: items.length, shipped: 0, delivered: 0, pending: 0, none: 0, out: 0 };
  for (const it of items) r[itemStatusOf(it)]++;
  // «out»: ya han salido (enviados o entregados)
  r.out = r.shipped + r.delivered;
  return r;
}
