// Estado de cada producto (sin empezar / pendiente / enviado): se cambia en la ficha, se guarda sin tocar importes,
// lo conserva el formulario al guardar, la copia empieza sin estados, la lista lo muestra. Además: barra de progreso y animaciones.
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const base = process.env.BASE || `http://localhost:${process.env.PORT || 8780}`;
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[1440, 900, 'escritorio'], [390, 844, 'móvil']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 });
    const mock = createMock(); seed(mock.db);
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept());
    const wt = ms => p.waitForTimeout(ms);
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await wt(1000);
    await p.getByTestId('login-username').fill('dvdtrebol3@gmail.com');
    await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await wt(2500);
    await p.goto(base + '/order-detail?orderId=o1', { waitUntil: 'networkidle' }); await wt(2500);
    const o1 = () => mock.db.orders.find(o => o.id === 'o1');
    const total0 = o1().total_with_vat, items0 = JSON.stringify(o1().items.map(({ item_status, ...x }) => x));
    check(`[${tag}] hay barra de progreso con los 4 pasos`, await p.getByTestId('progress-card').isVisible() && (await p.locator('[data-testid^="step-"]').count()) === 4);
    const pick = async (i, lab) => {
      await p.getByTestId('item-status-' + i).first().click(); await wt(600);
      await p.getByText(lab, { exact: true }).last().click(); await wt(1200);
    };
    await pick(0, 'Enviado'); await pick(1, 'Pendiente');
    check(`[${tag}] se guarda el estado de cada producto`, o1().items[0].item_status === 'shipped' && o1().items[1].item_status === 'pending', JSON.stringify(o1().items.map(x => x.item_status)));
    check(`[${tag}] no cambia importes ni el resto del producto`, o1().total_with_vat === total0 && JSON.stringify(o1().items.map(({ item_status, ...x }) => x)) === items0);
    await p.mouse.move(2, 2); await wt(600);
    const bg = await p.evaluate(() => [0, 1].map(i => getComputedStyle(document.querySelector(`[data-testid="item-row-${i}"]`)).backgroundColor));
    check(`[${tag}] fila azul cielo (enviado) y amarilla (pendiente)`, /rgba\(14, 165, 233|rgba\(56, 189, 248/.test(bg[0]) && /rgba\(255, 204, 0/.test(bg[1]), bg.join(' | '));
    check(`[${tag}] la chapa muestra el estado`, (await p.getByTestId('item-status-0').first().innerText()).includes('Enviado'));
    await pick(1, 'Entregado');
    const bgD = await p.evaluate(() => getComputedStyle(document.querySelector('[data-testid="item-row-1"]')).backgroundColor);
    check(`[${tag}] «Entregado» se guarda y tiene su color (verde)`, o1().items[1].item_status === 'delivered' && /rgba\(52, 199, 89|rgba\(48, 209, 88/.test(bgD), bgD);
    const pillH = await p.getByTestId('change-status').evaluate(e => e.getBoundingClientRect().height);
    check(`[${tag}] botón de estado de arriba con tamaño ajustado`, pillH >= 46 && pillH <= 52, String(pillH));
    await pick(1, 'Sin empezar');
    check(`[${tag}] «Sin empezar» quita el estado`, o1().items[1].item_status === undefined);
    // «Estado de todos» (o1 tiene 2 productos): los marca todos de una vez
    await p.getByTestId('item-status-all').first().click(); await wt(600);
    check(`[${tag}] «Estado de todos» abre las 4 opciones`, (await Promise.all(['Sin empezar', 'Pendiente', 'Enviado', 'Entregado'].map(l => p.getByText(l, { exact: true }).last().isVisible()))).every(Boolean));
    await p.getByText('Enviado', { exact: true }).last().click(); await wt(1400);
    check(`[${tag}] «Estado de todos» marca todos los productos`, o1().items.every(x => x.item_status === 'shipped'), JSON.stringify(o1().items.map(x => x.item_status)));
    // el formulario conserva los estados al guardar
    await p.getByTestId('edit-order-btn').click(); await wt(1800);
    await p.getByTestId('submit-order-btn').click(); await wt(2200);
    check(`[${tag}] editar y guardar conserva el estado`, o1().items[0].item_status === 'shipped', String(o1().items[0].item_status));
    // todo enviado → sugerencia (el pedido o3/o5 en pendiente o procesando)
    const target = mock.db.orders.find(o => (o.status === 'pending' || o.status === 'processing') && o.items.length > 0);
    await p.goto(base + '/order-detail?orderId=' + target.id, { waitUntil: 'networkidle' }); await wt(2200);
    for (let i = 0; i < target.items.length; i++) await pick(i, 'Enviado');
    const sug = p.getByTestId('suggest-shipped');
    // todos entregados → propone «Entregado»; luego se vuelven a «Enviado» para seguir
    // «Estado de todos»: los marca todos de una vez
    if (target.items.length > 1) {
      await p.getByTestId('item-status-all').first().click(); await wt(600);
      await p.getByText('Entregado', { exact: true }).last().click(); await wt(1400);
      check(`[${tag}] «Estado de todos» marca todos los productos`, mock.db.orders.find(o => o.id === target.id).items.every(x => x.item_status === 'delivered'));
    } else await pick(0, 'Entregado');
    check(`[${tag}] con todo entregado propone marcar el pedido como Entregado`, await p.getByTestId('suggest-delivered').isVisible());
    for (let i = 0; i < target.items.length; i++) await pick(i, 'Enviado');
    check(`[${tag}] con todo enviado sugiere marcar el pedido como Enviado`, await sug.isVisible());
    await sug.click(); await wt(1200);
    check(`[${tag}] la sugerencia cambia el estado del pedido`, mock.db.orders.find(o => o.id === target.id).status === 'shipped');
    await p.getByTestId('step-delivered').click(); await wt(1200);
    check(`[${tag}] pulsar un paso cambia el estado`, mock.db.orders.find(o => o.id === target.id).status === 'delivered');
    // copia sin estados
    const n0 = mock.db.orders.length;
    await p.getByTestId('duplicate-order-btn').click(); await wt(600);
    await p.getByTestId('web-alert-btn-Duplicar').click(); await wt(2500);
    await p.getByTestId('web-alert-btn-Seguir aquí').click().catch(() => {}); await wt(500);
    const copy = mock.db.orders.length === n0 + 1 ? mock.db.orders[mock.db.orders.length - 1] : null;
    check(`[${tag}] la copia empieza sin estados de producto`, !!copy && copy.items.every(x => !x.item_status));
    // lista: puntos de color
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await wt(2500);
    check(`[${tag}] la lista muestra cuántos están enviados`, /1 enviado|enviados/.test(await p.evaluate(() => document.body.innerText)));
    // animaciones terminan: nada se queda invisible
    const hidden = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="order-"]')].filter(e => getComputedStyle(e).opacity !== '1').length);
    check(`[${tag}] tras animarse todo queda visible`, hidden === 0);
    check(`[${tag}] sin errores`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} fallos` : '\nOK   todo bien');
})();
