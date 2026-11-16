/**
 * Exporta pedidos a Excel (.xlsx) en el navegador. Sirve también como copia de seguridad legible.
 * Hojas: Pedidos (uno por fila, con los campos de cliente en el orden de la hoja original),
 * Líneas, Envíos y Fabricantes. Los importes van como números con formato de euros.
 */
import { Platform } from 'react-native';
import type { Manufacturer, Order } from '@/types';

const STATUS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const day = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d;
};

const EUR = '#,##0.00 "€"';

export async function exportOrdersToExcel(orders: Order[], manufacturers: Manufacturer[], label = 'pedidos'): Promise<string> {
  if (Platform.OS !== 'web') throw new Error('La exportación a Excel está disponible en la versión web.');
  const XLSX = await import('xlsx');

  const sorted = [...orders].sort((a, b) => a.reference_number.localeCompare(b.reference_number, 'es', { numeric: true }));
  const pedidos = sorted.map(o => {
    const c = o.customer ?? ({} as Order['customer']);
    const shipping = (o.shipping_items ?? []).reduce((s, x) => s + (x.valor_con_iva || 0), 0);
    return {
      Referencia: o.reference_number,
      'Ref. manual': o.custom_reference || '',
      Estado: STATUS[o.status] ?? o.status,
      Fabricante: o.manufacturer_name,
      'Código fab.': o.manufacturer_code,
      Año: o.year,
      Creado: day(o.created_at),
      Actualizado: day(o.updated_at),
      'Fecha prevista': day(o.expected_date),
      Responsable: o.owner || '',
      'Siguiente acción': o.next_action || '',
      Empresa: c.nombre_empresa || '',
      Contacto: c.contacto || '',
      'Dpto.': c.departamento || '',
      'Su pedido - Nº Ref': c.numero_referencia_pedido || '',
      'Dir. 1': c.direccion_1 || '',
      'Dir. 2': c.direccion_2 || '',
      CP: c.codigo_postal || '',
      Provincia: c.provincia || '',
      País: c.pais || '',
      'Telf. 1': c.telefono_1 || '',
      'Telf. 2': c.telefono_2 || '',
      Email: c.email || '',
      NIF: c.nif || '',
      'Oferta/Proforma': c.oferta_proforma || '',
      'Cond. Entrega': c.condiciones_entrega || '',
      'Cond. Pago': c.condiciones_pago || '',
      'Nº Factura': c.numero_factura || '',
      'Nº Recibo': c.numero_recibo || '',
      'Nº productos': (o.items ?? []).length,
      'Productos sin IVA': o.total_ex_vat,
      'IVA productos': o.total_vat,
      'Gastos de envío (con IVA)': Math.round(shipping * 100) / 100,
      'Envío extra': o.shipping_cost,
      Total: o.total_with_vat,
    };
  });

  const lineas = sorted.flatMap(o =>
    (o.items ?? []).map((it, i) => ({
      Referencia: o.reference_number,
      Línea: i + 1,
      Producto: it.product_name,
      Cantidad: it.quantity,
      'Precio venta unit.': it.tpv_unitario,
      'Importe antes de dto.': it.total_sin_iva,
      'Dto. %': it.descuento_porcentaje,
      'Neto sin IVA': it.valor_sin_iva,
      'IVA %': it.vat_percentage,
      'Con IVA': it.valor_con_iva,
      'Coste unit.': it.costo_unitario,
      Beneficio: it.beneficio_bruto,
    })),
  );

  const envios = sorted.flatMap(o =>
    (o.shipping_items ?? []).map(s => ({
      Referencia: o.reference_number,
      Descripción: s.description,
      Cantidad: s.quantity,
      'Coste unit.': s.costo_unitario,
      'IVA %': s.vat_percentage,
      'Sin IVA': s.valor_sin_iva,
      'Con IVA': s.valor_con_iva,
    })),
  );

  const fabricantes = [...manufacturers]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map(m => ({ Nombre: m.name, Código: m.code, 'Años asignados': [...(m.active_years ?? [])].sort().join(', ') }));

  const wb = XLSX.utils.book_new();
  const add = (rows: Record<string, unknown>[], name: string, money: string[], dates: string[] = []) => {
    const ws = rows.length ? XLSX.utils.json_to_sheet(rows, { cellDates: true }) : XLSX.utils.aoa_to_sheet([['Sin datos']]);
    if (rows.length) {
      const headers = Object.keys(rows[0]);
      const range = XLSX.utils.decode_range(ws['!ref'] as string);
      headers.forEach((h, col) => {
        const fmt = money.includes(h) ? EUR : dates.includes(h) ? 'dd/mm/yyyy' : null;
        if (!fmt) return;
        for (let r = 1; r <= range.e.r; r++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
          if (cell && cell.v !== '') cell.z = fmt;
        }
      });
      ws['!cols'] = headers.map(h => ({ wch: Math.min(48, Math.max(h.length + 2, ...rows.slice(0, 200).map(r => String(r[h] instanceof Date ? '00/00/0000' : r[h] ?? '').length + 2))) }));
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }) };
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(pedidos, 'Pedidos', ['Productos sin IVA', 'IVA productos', 'Gastos de envío (con IVA)', 'Envío extra', 'Total'], ['Creado', 'Actualizado', 'Fecha prevista']);
  add(lineas, 'Líneas', ['Precio venta unit.', 'Importe antes de dto.', 'Neto sin IVA', 'Con IVA', 'Coste unit.', 'Beneficio']);
  add(envios, 'Envíos', ['Coste unit.', 'Sin IVA', 'Con IVA']);
  add(fabricantes, 'Fabricantes', []);

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `AO-Gestiones-${label}-${stamp}.xlsx`;
  XLSX.writeFile(wb, fileName, { compression: true });
  return fileName;
}
