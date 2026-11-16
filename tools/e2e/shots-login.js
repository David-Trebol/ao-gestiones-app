// Capturas de la pantalla de entrada (claro y oscuro) en móvil y ordenador: node e2e/shots-login.js <puerto>
const { chromium } = require('playwright');
const { createMock } = require('./mock');
const port = process.argv[2] || 8780;
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const mock = createMock();
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
    await p.screenshot({ path: `out/login-${scheme}-${tag}.png` });
    await ctx.close();
  }
  await b.close();
})();
