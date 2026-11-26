// Inicio nuevo, detalle y formulario: node t9-home.js (PORT)
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const results = [];
const check = (n, ok, x = '') => results.push((ok ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' — ' + x : ''));
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const tag = vp.width > 1000 ? '[escritorio]' : '[móvil]';
    const ctx = await b.newContext({ viewport: vp });
    const mock = createMock(); seed(mock.db); mock.db.orders.forEach(o => { o.custom_reference = ''; }); // la lista enseña la referencia automática
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const w = ms => p.waitForTimeout(ms);
    const txt = async () => (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
    const base = `http://localhost:${process.env.PORT}`;
    await p.goto(base, { waitUntil: 'networkidle' }); await w(1200);
    await p.getByTestId('login-username').fill('dvdtrebol3@gmail.com'); await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await w(2500);
    let t = await txt();
    check(`${tag} contadores con nombres completos`, ['Pendiente', 'Procesando', 'Enviado', 'Entregado', 'Cancelado'].every(x => t.includes(x)) && !/Env\.|Pend\./.test(t));
    check(`${tag} lista con 5 pedidos`, /Todos los pedidos\W+5/i.test(t), (t.match(/Todos los pedidos\W+\d+/i) || [''])[0]);
    check(`${tag} sección requieren atención`, /Requieren atención\W+\d/i.test(t));
    await p.getByTestId('counter-shipped').click(); await w(500); t = await txt();
    check(`${tag} contador abre lista filtrada (Enviado · 1)`, /Enviado\W+1/i.test(t) && t.includes('TPG-2026-001'), (t.match(/Enviado\W+\d+/i) || [''])[0]);
    await p.getByTestId('counter-shipped').click(); await w(400);
    await p.getByTestId('home-search').fill('ruiz'); await w(500); t = await txt();
    check(`${tag} buscar por cliente`, /Todos los pedidos\W+1/i.test(t) && t.includes('ACM-2025-001'));
    await p.getByTestId('home-search').fill(''); await w(300);
    await p.getByText('Más recientes').click(); await w(400); await p.getByText('Importe: mayor primero', { exact: true }).click(); await w(500);
    const firstRef = await p.evaluate(() => { const el = document.querySelector('[data-testid^="order-row-"],[data-testid^="order-card-"]'); return el ? el.getAttribute('data-testid') : ''; });
    check(`${tag} ordenar por importe`, /o1$/.test(firstRef), firstRef);
    await p.getByText('Referencia', { exact: true }).first().click(); await w(400); await p.getByText('TechParts Global', { exact: true }).last().click(); await w(500); t = await txt();
    check(`${tag} filtro fabricante`, /Todos los pedidos\W+1/i.test(t) && /Quitar filtros \(1\)/.test(t));
    // abrir un pedido y volver: se conservan filtros
    await p.getByText('TPG-2026-001').first().click(); await w(1500); t = await txt();
    check(`${tag} detalle: referencia, estado y total arriba`, /Referencia \| TPG-2026-001/.test(t) && /Total con IVA/.test(t) && /Enviado/.test(t));
    await p.getByTestId('change-status').click(); await w(400); await p.getByText('Entregado', { exact: true }).last().click(); await w(1200);
    check(`${tag} cambiar estado desde el detalle`, mock.db.orders.find(o => o.id === 'o3').status === 'delivered');
    await p.goBack(); await w(1500); t = await txt();
    check(`${tag} al volver se conservan los filtros`, /Quitar filtros \(1\)/.test(t) && /TechParts Global/.test(t));
    // autocompletar cliente
    await p.goto(base + '/order-form', { waitUntil: 'networkidle' }); await w(1500);
    await p.getByLabel('Empresa', { exact: true }).fill('Constru'); await w(500); t = await txt();
    check(`${tag} sugiere clientes anteriores`, /Clientes de pedidos anteriores/i.test(t) && /Construcciones García/.test(t));
    await p.getByText('Construcciones García S.A.').last().click(); await w(500);
    const nif = await p.getByLabel('NIF / CIF', { exact: true }).inputValue();
    check(`${tag} autocompletar rellena campos vacíos`, nif === 'B12345678' && /Se han completado/.test(await txt()), nif);
    // seguimiento: retraso visible en inicio y detalle
    await p.goto(base, { waitUntil: 'networkidle' }); await w(1800); t = await txt();
    check(`${tag} aviso de pedidos con retraso`, /requieren? atención/i.test(t) && /1 con retraso/i.test(t));
    await p.getByTestId('filter-overdue').click(); await w(500); t = await txt();
    check(`${tag} filtro con retraso`, /Con retraso\W+1/i.test(t) && t.includes('ACM-2026-002'));
    await p.goto(base + '/order-detail?orderId=o2', { waitUntil: 'networkidle' }); await w(1500); t = await txt();
    check(`${tag} detalle muestra seguimiento`, /01\/10\/2026 · \d+ días de retraso/.test(t) && t.includes('David') && t.includes('Llamar al fabricante'));
    // editar seguimiento desde el formulario
    await p.getByTestId('edit-order-btn').click(); await w(1800);
    await p.locator('input[type="date"]').first().fill('2027-01-15'); await w(300);
    await p.getByLabel('Responsable', { exact: true }).fill('Laura'); await p.getByLabel('Siguiente acción', { exact: true }).fill('Enviar proforma');
    await p.getByTestId('submit-order-btn').click(); await w(2200);
    const o2 = mock.db.orders.find(o => o.id === 'o2');
    check(`${tag} guarda fecha prevista, responsable y siguiente acción`, o2.expected_date === '2027-01-15' && o2.owner === 'Laura' && o2.next_action === 'Enviar proforma', `${o2.expected_date} ${o2.owner} ${o2.next_action}`);
    check(`${tag} no toca otros datos al guardar`, o2.reference_number === 'ACM-2026-002' && o2.total_with_vat > 0 && o2.customer.nombre_empresa === 'Instalaciones López');
    if (errs.length) check(`${tag} sin errores de página`, false, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  console.log(results.join('\n'));
  await b.close();
})();
