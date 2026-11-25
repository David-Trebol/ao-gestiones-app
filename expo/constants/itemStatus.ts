import type { ItemStatus, OrderItem } from '@/types';
import type { ThemeColors } from '@/constants/colors';

/**
 * Estado de cada producto de un pedido. Usa los MISMOS colores que el progreso del pedido:
 * - Sin empezar: el color normal (no se ha hecho nada con él)
 * - Pendiente: amarillo, como «Procesando» (en marcha, a la espera de enviarse)
 * - Enviado: azul cielo, como «Enviado»
 * - Entregado: verde, como «Entregado»
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
      return { text: c.statusDeliveredText, bg: c.statusDeliveredBg, border: isDark ? 'rgba(48,209,88,0.40)' : 'rgba(52,199,89,0.45)', dot: isDark ? '#30D158' : '#22A447', row: isDark ? 'rgba(48,209,88,0.08)' : 'rgba(52,199,89,0.07)' };
    case 'shipped':
      return { text: c.statusShippedText, bg: c.statusShippedBg, border: isDark ? 'rgba(56,189,248,0.45)' : 'rgba(14,165,233,0.42)', dot: isDark ? '#38BDF8' : '#0EA5E9', row: isDark ? 'rgba(56,189,248,0.09)' : 'rgba(14,165,233,0.07)' };
    case 'pending':
      return { text: c.statusProcessingText, bg: c.statusProcessingBg, border: isDark ? 'rgba(255,204,0,0.38)' : 'rgba(230,180,0,0.55)', dot: isDark ? '#FFCC00' : '#F2B705', row: isDark ? 'rgba(255,204,0,0.07)' : 'rgba(255,204,0,0.09)' };
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
