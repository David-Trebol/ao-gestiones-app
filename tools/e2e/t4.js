const { boot } = require('./e2e-lib');
const results = [];
const check = (name, ok, extra = '') => results.push((ok ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : ''));
const mkOrder = (id, ref, m, year, extra = {}) => ({ id, reference_number: ref, custom_reference: '', manufacturer_id: m.id, manufacturer_name: m.name, manufacturer_code: m.code, year, status: 'delivered', customer: { nombre_empresa: 'Empresa ' + id, contacto: 'García', numero_factura: 'F-' + id, email: id + '@x.es' }, items: [{ product_name: 'Prod ' + id, quantity: 1, costo_unitario: 1, tpv_unitario: 0, total_sin_iva: 100, descuento_porcentaje: 0, vat_percentage: 21, pvp_neto_sin_iva: 100, valor_sin_iva: 100, beneficio_bruto: 99, valor_con_iva: 121 }], shipping_items: [], shipping_cost: 0, total_ex_vat: 100, total_vat: 21, total_with_vat: 121, created_at: '2026-01-0' + id.slice(-1), updated_at: '2026-01-01', ...extra });
(async () => {
  const { b, p, log, text, shot, wait, mock } = await boot();
  const db = mock.db;
  const A = { id: 'm1', name: 'Acme', code: 'ACM', active_years: [2026], created_at: '2026-01-01' };
  const T = { id: 'm2', name: 'TechParts', code: 'TPG', active_years: [2026], created_at: '2026-01-01' };
  db.years.push({ year: 2026 }); db.manufacturers.push(A, T);
  db.orders.push(mkOrder('o1', 'ACM-2026-001', A, 2026), mkOrder('o2', 'ACM-2026-002', A, 2026), mkOrder('o3', 'TPG-2026-001', T, 2026));
  await p.reload({ waitUntil: 'networkidle' }); await wait(2500);
  const tab = async name => { await p.getByText(name, { exact: true }).last().click(); await wait(1300); };
  const btn = async t => { await p.getByTestId(`web-alert-btn-${t}`).click(); await wait(1800); };
  // Duplicar año + pedidos (copy icon on year card)
  await p.getByTestId('home-mode-carpetas').click(); await wait(800);
  await p.getByLabel('Duplicar 2026').click(); await wait(1000);
  await shot('30-dup-year-dialog');
  const dt = await text();
  check('diálogo duplicar año visible', /Duplicar año 2026/.test(dt));
  await btn('Año + pedidos'); await wait(2500);
  const y27 = db.orders.filter(o => o.year === 2027);
  check('duplicar año copia los 3 pedidos (antes solo 1)', y27.length === 3, y27.map(o => o.reference_number).join(','));
  check('referencias 2027 correctas y únicas', JSON.stringify(y27.map(o => o.reference_number).sort()) === JSON.stringify(['ACM-2027-001', 'ACM-2027-002', 'TPG-2027-001']));
  check('copias pendientes y sin factura', y27.every(o => o.status === 'pending' && o.customer.numero_factura === ''));
  check('año 2027 creado', db.years.some(y => y.year === 2027));
  const okb = p.getByTestId('web-alert-btn-OK'); if (await okb.count()) await okb.click(); await wait(500);
  // Búsqueda
  await tab('Buscar');
  await p.locator('input').first().fill('garcía'); await wait(1200);
  const st = await text();
  check('búsqueda por contacto (6 resultados)', /6 resultados/.test(st), (st.match(/\d+ resultados?/) || [''])[0]);
  await p.locator('input').first().fill('F-o1'); await wait(1000);
  check('búsqueda por nº factura', /1 resultado/.test(await text()));
  // Fabricantes: editar nombre se propaga a pedidos
  await tab('Fabricantes');
  await p.getByTestId('edit-manufacturer-m1').click(); await wait(800);
  await p.getByTestId('edit-name-input').fill('Acme Renombrada');
  await p.getByText('Actualizar', { exact: true }).last().click(); await wait(2000);
  check('renombrar fabricante actualiza sus pedidos', db.orders.filter(o => o.manufacturer_id === 'm1').every(o => o.manufacturer_name === 'Acme Renombrada'));
  // borrar fabricante con pedidos -> bloqueado
  await p.getByTestId('delete-manufacturer-m2').click(); await wait(800);
  await btn('Eliminar');
  check('no deja borrar fabricante con pedidos', db.manufacturers.some(m => m.id === 'm2') && /tiene pedidos asociados/.test(await text()));
  const ok2 = p.getByTestId('web-alert-btn-OK'); if (await ok2.count()) await ok2.click(); await wait(400);
  // Ajustes
  await tab('Ajustes');
  await shot('31-settings', true);
  const s = await text();
  check('ajustes muestra usuario y email', /David/.test(s) && /dvdtrebol3@gmail.com/.test(s));
  check('resumen: 6 pedidos, 2 fabricantes, 2 años', /6 \| Pedidos/.test(s) && /2 \| Fabricantes/.test(s) && /2 \| Años/.test(s), (s.match(/Resumen[^]*?Años/) || [''])[0]);
  check('sin "Restaurar datos de ejemplo"', !/Restaurar datos de ejemplo/.test(s));
  check('facturación total 726,00 €', /726,00\s?€/.test(s));
  // Escaneo IA sin clave -> mensaje claro (se prueba la función directamente)
  // Logout
  await p.getByTestId('logout-btn').click(); await wait(800);
  await btn('Salir'); await wait(1500);
  check('cerrar sesión vuelve al login', (await p.getByTestId('login-submit').count()) > 0);
  console.log(results.join('\n'));
  console.log('\nLOG:', log.join('\n'));
  await b.close();
})();
