// Fase 2: Ajustes (copia completa, borrado protegido), Fabricantes (menú «…») y selector de fabricante con buscador
// PORT=8780 node e2e/t10-fase2.js
const { boot } = require('./e2e-lib');
const { seed } = require('./seed');
const results = [];
const check = (name, ok, extra = '') => results.push((ok ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : ''));
(async () => {
  const { b, p, log, text, wait, mock } = await boot();
  seed(mock.db);
  for (let i = 1; i <= 6; i++) mock.db.manufacturers.push({ id: 'mx' + i, name: 'Fabricante Extra ' + i, code: 'FX' + i, active_years: [2026], created_at: '2026-01-01' });
  mock.db.manufacturers.push({ id: 'mz', name: 'Rodamientos Martínez', code: 'ROD', active_years: [2026], created_at: '2026-01-01' });
  await p.reload({ waitUntil: 'networkidle' }); await wait(2500);
  const nOrders = mock.db.orders.length;

  // --- Selector de fabricante con buscador
  await p.goto(`http://localhost:${process.env.PORT}/order-form`, { waitUntil: 'networkidle' }); await wait(1500);
  await p.getByTestId('manufacturer-select').click(); await wait(500);
  check('selector de fabricante con buscador', (await p.getByTestId('sheet-search').count()) === 1);
  await p.getByTestId('sheet-search').fill('martinez'); await wait(300);
  let t = await text();
  check('buscar sin acentos encuentra «Martínez»', t.includes('Rodamientos Martínez (ROD)') && !t.includes('Fabricante Extra 1'));
  await p.getByText('Rodamientos Martínez (ROD)').last().click(); await wait(400);
  check('el fabricante elegido aparece en el campo', (await p.getByTestId('manufacturer-select').innerText()).includes('Rodamientos Martínez'));

  // --- Fabricantes: menú «…»
  await p.goto(`http://localhost:${process.env.PORT}/manufacturers`, { waitUntil: 'networkidle' }); await wait(1500);
  await p.getByTestId('manufacturer-menu-mz').click(); await wait(500);
  t = await text();
  check('menú con acciones con nombre', ['Editar nombre y código', 'Asignar años', 'Duplicar fabricante', 'Eliminar fabricante'].every(x => t.includes(x)));
  await p.getByText('Duplicar fabricante', { exact: true }).last().click(); await wait(1500);
  check('duplicar desde el menú', mock.db.manufacturers.length === 11, String(mock.db.manufacturers.length));
  const okb = p.getByTestId('web-alert-btn-OK'); if (await okb.count()) { await okb.click(); await wait(300); }

  // --- Ajustes: copia completa
  await p.goto(`http://localhost:${process.env.PORT}/settings`, { waitUntil: 'networkidle' }); await wait(1500);
  {
    const expected = mock.db.orders.filter(o => o.status !== 'cancelled').reduce((x, o) => x + o.total_with_vat, 0);
    const fmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(expected).replace(/\s/g, ' ');
    const st = (await text()).replace(/\s/g, ' ');
    check('facturación total sin cancelados', st.includes(fmt) && /no cuenta 1 cancelado/.test(st), fmt);
  }
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), p.getByTestId('export-all-btn').click()]);
  check('descarga la copia completa en Excel', !!dl && /\.xlsx$/.test(dl.suggestedFilename()), dl ? dl.suggestedFilename() : 'sin descarga');
  if (await okb.count()) { await okb.click(); await wait(300); }

  // --- Ajustes: borrado protegido
  await p.getByTestId('delete-all-btn').click(); await wait(600);
  await p.getByTestId('delete-confirm-btn').click({ force: true }); await wait(800);
  check('sin escribir ELIMINAR no borra', mock.db.orders.length === nOrders);
  await p.getByTestId('delete-confirm-input').fill('elimina'); await p.getByTestId('delete-confirm-btn').click({ force: true }); await wait(800);
  check('con un texto incompleto no borra', mock.db.orders.length === nOrders);
  await p.getByTestId('delete-cancel-btn').click(); await wait(500);
  check('cancelar no borra', mock.db.orders.length === nOrders);
  await p.getByTestId('delete-all-btn').click(); await wait(600);
  await p.getByTestId('delete-confirm-input').fill('eliminar'); await wait(200);
  await p.getByTestId('delete-confirm-btn').click(); await wait(2000);
  check('al escribir ELIMINAR (en minúsculas también) sí borra', mock.db.orders.length === 0 && mock.db.manufacturers.length === 0, `${mock.db.orders.length} pedidos`);

  console.log(results.join('\n'));
  console.log('\nLOG:', log.join('\n'));
  await b.close();
})();
