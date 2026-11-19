// «Pedidos» en la navegación siempre vuelve a la lista, aunque haya un pedido abierto (también al venir de otra sección).
// Además comprueba que las animaciones de entrada existen y terminan (nada se queda invisible).
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const base = process.env.BASE || `http://localhost:${process.env.PORT || 8780}`;
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[1440, 900, 'escritorio'], [390, 844, 'móvil']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const mock = createMock(); seed(mock.db);
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage();
    await p.goto(base + '/?r=' + Date.now(), { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    await p.getByTestId('login-username').fill('dvdtrebol3@gmail.com');
    await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await p.waitForTimeout(2500);
    await p.waitForTimeout(1500);
    const hidden = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="order-row-"],[data-testid^="order-card-"]')].filter(e => getComputedStyle(e).opacity !== '1').length);
    check(`[${tag}] la lista queda visible tras animarse`, hidden === 0);
    const listVisible = async () => p.evaluate(() => [...document.querySelectorAll('[data-testid^="order-row-"],[data-testid^="order-card-"]')].some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden' && e.closest('[aria-hidden="true"]') === null; }));
    const detailVisible = async () => p.evaluate(() => [...document.querySelectorAll('[data-testid="edit-order-btn"]')].some(e => e.getBoundingClientRect().width > 0 && e.closest('[aria-hidden="true"]') === null && document.elementFromPoint(e.getBoundingClientRect().x + e.getBoundingClientRect().width / 2, e.getBoundingClientRect().y + e.getBoundingClientRect().height / 2)?.closest('[data-testid="edit-order-btn"]')));
    // 1) pedido abierto → «Pedidos»
    await p.locator('[data-testid^="order-row-"],[data-testid^="order-card-"]').first().click(); await p.waitForTimeout(150);
    const anims = await p.evaluate(() => [...new Set(document.getAnimations().map(a => a.animationName))].join(' '));
    check(`[${tag}] la ficha entra con animación`, /ao-pop/.test(anims) && /ao-rise/.test(anims), anims);
    await p.waitForTimeout(1400);
    check(`[${tag}] se abre el pedido`, await detailVisible());
    await p.getByTestId('nav-Pedidos').click(); await p.waitForTimeout(1500);
    check(`[${tag}] «Pedidos» con un pedido abierto vuelve a la lista`, (await listVisible()) && !(await detailVisible()));
    // 2) pedido abierto → Fabricantes → «Pedidos»
    await p.locator('[data-testid^="order-row-"],[data-testid^="order-card-"]').first().click(); await p.waitForTimeout(1500);
    await p.getByTestId('nav-Fabricantes').click(); await p.waitForTimeout(1200);
    await p.getByTestId('nav-Pedidos').click(); await p.waitForTimeout(1500);
    check(`[${tag}] desde Fabricantes, «Pedidos» vuelve a la lista y no al pedido`, (await listVisible()) && !(await detailVisible()));
    // 3) «Atrás» del navegador sigue funcionando
    await p.locator('[data-testid^="order-row-"],[data-testid^="order-card-"]').first().click(); await p.waitForTimeout(1500);
    await p.getByTestId('detail-back').click(); await p.waitForTimeout(1200);
    check(`[${tag}] el botón «Pedidos» de la ficha vuelve a la lista`, await listVisible());
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} fallos` : '\nOK   todo bien');
})();
