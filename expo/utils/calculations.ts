import { OrderFormItem, ShippingFormItem, OrderItem, ShippingItem } from '@/types';

export function calculateItemTotals(item: OrderFormItem): OrderItem {
  let valor_sin_iva: number;
  let pvp_neto_sin_iva: number;

  const factorDescuento = 1 - (item.descuento_porcentaje || 0) / 100;

  if (item.total_sin_iva > 0) {
    // "Total s/IVA" es el importe de la línea antes de descuento
    valor_sin_iva = item.total_sin_iva * factorDescuento;
    pvp_neto_sin_iva = item.quantity > 0 ? valor_sin_iva / item.quantity : 0;
  } else {
    pvp_neto_sin_iva = (item.tpv_unitario || 0) * factorDescuento;
    valor_sin_iva = pvp_neto_sin_iva * item.quantity;
  }

  // Beneficio bruto de la línea completa (venta neta - coste de todas las unidades)
  const beneficio_bruto = valor_sin_iva - item.costo_unitario * item.quantity;
  const valor_con_iva = valor_sin_iva * (1 + item.vat_percentage / 100);

  return {
    product_name: item.product_name,
    quantity: item.quantity,
    costo_unitario: item.costo_unitario,
    tpv_unitario: item.tpv_unitario,
    total_sin_iva: item.total_sin_iva,
    descuento_porcentaje: item.descuento_porcentaje,
    vat_percentage: item.vat_percentage,
    pvp_neto_sin_iva: Math.round(pvp_neto_sin_iva * 100) / 100,
    valor_sin_iva: Math.round(valor_sin_iva * 100) / 100,
    beneficio_bruto: Math.round(beneficio_bruto * 100) / 100,
    valor_con_iva: Math.round(valor_con_iva * 100) / 100,
  };
}

export function calculateShippingTotals(shipping: ShippingFormItem): ShippingItem {
  let valor_sin_iva: number;

  if (shipping.total_sin_iva > 0) {
    valor_sin_iva = shipping.total_sin_iva;
  } else {
    valor_sin_iva = shipping.costo_unitario * shipping.quantity;
  }

  const valor_con_iva = valor_sin_iva * (1 + shipping.vat_percentage / 100);

  return {
    description: shipping.description,
    quantity: shipping.quantity,
    costo_unitario: shipping.costo_unitario,
    total_sin_iva: shipping.total_sin_iva,
    vat_percentage: shipping.vat_percentage,
    valor_sin_iva: Math.round(valor_sin_iva * 100) / 100,
    valor_con_iva: Math.round(valor_con_iva * 100) / 100,
  };
}

/**
 * Siguiente referencia libre para fabricante+año. Usa el número más alto existente
 * (no el recuento) para no repetir referencias después de borrar pedidos.
 */
export function generateReferenceNumber(manufacturerCode: string, year: number, existingReferences: string[]): string {
  const prefix = `${manufacturerCode}-${year}-`;
  const maxNum = existingReferences.reduce((max, ref) => {
    if (!ref?.startsWith(prefix)) return max;
    const n = parseInt(ref.slice(prefix.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateLong(dateString: string): string {
  const date = new Date(dateString);
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}
