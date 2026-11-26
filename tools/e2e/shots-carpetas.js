// Capturas de la vista «Por año y fabricante» (años → fabricantes → pedidos) en móvil, tablet y ordenador
// node e2e/shots-carpetas.js <puerto>
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const port = process.argv[2] || 8780;
const sizes = [[390, 844, 'm'], [768, 1024, 't'], [1440, 900, 'd']];
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const mock = createMock(); seed(mock.db);
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.getByTestId('login-username').fill('admin@ao-gestiones.test'); await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await p.waitForTimeout(2500);
    await p.getByTestId('home-mode-carpetas').click(); await p.waitForTimeout(1200);
    await p.screenshot({ path: `out/carpetas-1-anos-${tag}.png` });
    await p.locator('[data-testid^="year-folder-"]').first().click(); await p.waitForTimeout(1200);
    await p.screenshot({ path: `out/carpetas-2-fabricantes-${tag}.png` });
    await p.locator('[data-testid^="manufacturer-folder-"]').first().click(); await p.waitForTimeout(1200);
    await p.screenshot({ path: `out/carpetas-3-pedidos-${tag}.png` });
    const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const flotante = await p.locator('[data-testid="new-order-fab"]').count();
    const atras = await p.getByText('Atrás', { exact: true }).count();
    console.log(`${tag} ${w}x${h}: ${over ? 'DESBORDA' : 'sin desborde'} · botón flotante: ${flotante} · «Atrás»: ${atras} · errores: ${errs.length}`);
    await ctx.close();
  }
  await b.close();
})();
