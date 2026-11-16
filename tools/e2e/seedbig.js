// 300 pedidos, referencias y nombres largos, importes grandes y pedidos con muchas líneas
const { seed } = require('./seed');
exports.seedBig = db => {
  seed(db);
  const mfs = db.manufacturers;
  const L = { id: 'm9', name: 'Fabricación Industrial de Componentes Electromecánicos del Mediterráneo', code: 'FIC', active_years: [], created_at: '2025-01-01' };
  db.manufacturers.push(L);
  const sts = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  const now = Date.now();
  for (let i = 0; i < 300; i++) {
    const m = i % 7 === 0 ? L : mfs[i % 3];
    const nLines = i % 25 === 0 ? 40 : 1 + (i % 4);
    const items = Array.from({ length: nLines }, (_, k) => {
      const q = 1 + ((i + k) % 9), t = 10 + ((i * 37 + k * 13) % 900) * (i % 50 === 0 ? 900 : 1);
      const v = t; return { product_name: `Artículo ${k + 1} de referencia larguísima con descripción técnica detallada ${i}-${k}`, quantity: q, costo_unitario: t / q * 0.6, tpv_unitario: 0, total_sin_iva: t, descuento_porcentaje: 0, vat_percentage: 21, pvp_neto_sin_iva: +(v / q).toFixed(2), valor_sin_iva: +v.toFixed(2), beneficio_bruto: +(v * 0.4).toFixed(2), valor_con_iva: +(v * 1.21).toFixed(2) };
    });
    const ex = items.reduce((s, x) => s + x.valor_sin_iva, 0);
    const created = new Date(now - (i * 3 + 1) * 86400000).toISOString();
    const updated = new Date(now - (i % 40) * 86400000).toISOString();
    const year = new Date(created).getFullYear();
    db.orders.push({ id: 'b' + i, reference_number: `${m.code}-${year}-${String(100 + i).padStart(3, '0')}`, custom_reference: i % 5 === 0 ? `PEDIDO-CLIENTE-MUY-LARGO-${i}-REVISION-B` : '', manufacturer_id: m.id, manufacturer_name: m.name, manufacturer_code: m.code, year, status: sts[i % 5],
      customer: { nombre_empresa: i % 11 === 0 ? '' : i % 3 === 0 ? `Corporación Internacional de Distribución y Logística Integral Número ${i} S.L.U.` : `Cliente ${i} S.L.`, contacto: 'Ana Pérez', departamento: '', direccion_1: 'Calle Mayor 1', direccion_2: '', codigo_postal: '28001', provincia: 'Madrid', pais: 'España', telefono_1: '600000000', telefono_2: '', email: `c${i}@x.es`, nif: 'B12345678', numero_referencia_pedido: `SU-${i}`, oferta_proforma: '', condiciones_entrega: '', condiciones_pago: '', numero_factura: i % 4 === 0 ? `FA-${i}` : '', numero_recibo: '' },
      items, shipping_items: [], shipping_cost: 0, total_ex_vat: +ex.toFixed(2), total_vat: +(ex * 0.21).toFixed(2), total_with_vat: +(ex * 1.21).toFixed(2), created_at: created, updated_at: updated, expected_date: i % 3 === 0 ? new Date(now + (i % 2 ? -1 : 1) * (i % 30) * 86400000).toISOString().slice(0, 10) : null, owner: ['', 'David', 'Laura Gómez Fernández', 'Equipo de compras'][i % 4], next_action: i % 6 === 0 ? 'Confirmar con el fabricante la fecha de salida del camión y avisar al cliente' : '' });
    if (!db.years.some(y => y.year === year)) db.years.push({ year });
  }
};
