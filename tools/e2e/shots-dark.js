// Capturas en modo oscuro (inicio, ficha, formulario, ajustes) en móvil y ordenador: node e2e/shots-dark.js <puerto>
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const port = process.argv[2] || 8780;
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => localStorage.setItem('@ao_theme_mode', 'dark'));
    const mock = createMock(); seed(mock.db);
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage();
    const base = `http://localhost:${port}`;
    await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `out/dark-login-${tag}.png` });
    await p.getByTestId('login-username').fill('admin@ao-gestiones.test'); await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await p.waitForTimeout(2500);
    for (const [name, url] of [['home', '/'], ['detail', '/order-detail?orderId=o1'], ['form', '/order-form?editOrderId=o1'], ['settings', '/settings']]) {
      if (url !== '/') await p.goto(base + url, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1800);
      await p.screenshot({ path: `out/dark-${name}-${tag}.png` });
    }
    await ctx.close();
  }
  await b.close();
})();
