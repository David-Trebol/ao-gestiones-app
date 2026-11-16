exports.seed = (db) => {
  const A = { id: 'm1', name: 'Acme Industries', code: 'ACM', active_years: [2026, 2025], created_at: '2025-01-01' };
  const T = { id: 'm2', name: 'TechParts Global', code: 'TPG', active_years: [2026], created_at: '2025-01-01' };
  const E = { id: 'm3', name: 'EuroSupply S.L.', code: 'EUR', active_years: [2025], created_at: '2025-01-01' };
  db.years.push({ year: 2026 }, { year: 2025 }); db.manufacturers.push(A, T, E);
  const item = (n, q, t, d, c) => { const v = t * (1 - d / 100); return { product_name: n, quantity: q, costo_unitario: c, tpv_unitario: 0, total_sin_iva: t, descuento_porcentaje: d, vat_percentage: 21, pvp_neto_sin_iva: +(v / q).toFixed(2), valor_sin_iva: +v.toFixed(2), beneficio_bruto: +(v - c * q).toFixed(2), valor_con_iva: +(v * 1.21).toFixed(2) }; };
  const mk = (id, ref, m, year, status, empresa, items, ship = []) => { const ex = items.reduce((s, i) => s + i.valor_sin_iva, 0); const vat = items.reduce((s, i) => s + i.valor_con_iva - i.valor_sin_iva, 0); const sh = ship.reduce((s, x) => s + x.valor_con_iva, 0); return { id, reference_number: ref, custom_reference: 'PO-' + id.toUpperCase(), manufacturer_id: m.id, manufacturer_name: m.name, manufacturer_code: m.code, year, status, customer: { nombre_empresa: empresa, contacto: 'María García', departamento: 'Compras', direccion_1: 'Calle Mayor 15', direccion_2: 'Planta 3', codigo_postal: '28001', provincia: 'Madrid', pais: 'España', telefono_1: '+34 912 345 678', telefono_2: '', email: 'compras@empresa.es', nif: 'B12345678', numero_referencia_pedido: 'CG-100', oferta_proforma: 'PRF-001', condiciones_entrega: 'DDP Madrid', condiciones_pago: '30 días', numero_factura: 'FA-2026-051', numero_recibo: '' }, items, shipping_items: ship, shipping_cost: 0, total_ex_vat: +ex.toFixed(2), total_vat: +vat.toFixed(2), total_with_vat: +(ex + vat + sh).toFixed(2), created_at: '2026-0' + (1 + (id.charCodeAt(1) % 8)) + '-10T10:00:00Z', updated_at: '2026-02-01T10:00:00Z' }; };
  const ship = [{ description: 'Transporte urgente', quantity: 1, costo_unitario: 45, total_sin_iva: 0, vat_percentage: 21, valor_sin_iva: 45, valor_con_iva: 54.45 }];
  db.orders.push(
    mk('o1', 'ACM-2026-001', A, 2026, 'delivered', 'Construcciones García S.A.', [item('Motor eléctrico 5HP - Trifásico 400V IE3', 2, 960, 5, 320), item('Controlador PLC Siemens', 1, 1250, 0, 890)], ship),
    { ...mk('o2', 'ACM-2026-002', A, 2026, 'processing', 'Instalaciones López', [item('Variador de frecuencia 3kW', 1, 668.66, 0, 410)]), expected_date: '2026-10-01', owner: 'David', next_action: 'Llamar al fabricante para confirmar envío' },
    mk('o3', 'TPG-2026-001', T, 2026, 'shipped', 'Electrónica Moderna S.L.', [item('Sensor inductivo M12', 10, 480, 5, 28), item('Cable apantallado 50m', 2, 230, 0, 60)]),
    mk('o4', 'ACM-2025-001', A, 2025, 'pending', 'Talleres Ruiz', [item('Reductor sinfín', 1, 540, 0, 300)]),
    mk('o5', 'EUR-2025-001', E, 2025, 'cancelled', 'Hostelería del Norte', [item('Bomba centrífuga', 1, 1320, 10, 700)]),
  );
};
