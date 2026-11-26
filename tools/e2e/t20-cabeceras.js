// Cabeceras de seguridad: la app entera (entrar, pedidos, leer un PDF y una foto con OCR, Excel)
// funciona con la política de contenidos (CSP) de expo/vercel.json. En local se inyectan las
// cabeceras de vercel.json; con BASE=https://… se comprueban las reales.
const { chromium } = require('playwright');
const path = require('path');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const vercel = require('../../expo/vercel.json');
const base = process.env.BASE || `http://localhost:${process.env.PORT || 8780}`;
const local = !process.env.BASE;
const HEAD = Object.fromEntries(vercel.headers.find(h => h.source === '/(.*)').headers.map(h => [h.key.toLowerCase(), h.value]));
let fails = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const mock = createMock(); seed(mock.db);
  await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
  await ctx.route('wss://**', r => r.abort());
  if (local) await ctx.route(base + '/**', async r => { const res = await r.fetch(); await r.fulfill({ response: res, headers: { ...res.headers(), ...HEAD } }); });
  const p = await ctx.newPage(); const errs = []; const csp = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) csp.push(t.slice(0, 200)); });
  const wt = ms => p.waitForTimeout(ms);
  const r0 = await p.goto(base + '/', { waitUntil: 'networkidle' }); await wt(1000);
  const h = r0.headers();
  for (const k of Object.keys(HEAD)) check(`cabecera ${k}`, !!h[k], (h[k] || '').slice(0, 60));
  await p.getByTestId('login-username').fill('admin@ao-gestiones.test');
  await p.getByTestId('login-password').fill(PASSWORD);
  await p.getByTestId('login-submit').click(); await wt(2500);
  check('entrar', (await p.getByText('Todos los pedidos').count()) > 0);
  const font = await p.evaluate(() => document.fonts.check('16px Figtree'));
  check('carga la tipografía Figtree', font);
  for (const f of ['01-factura-proveedor.pdf', '04-factura-foto.png']) {
    await p.goto(base + '/order-form', { waitUntil: 'networkidle' }); await wt(1500);
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.getByTestId('scan-document-btn').click()]);
    await fc.setFiles(path.join(__dirname, '..', 'samples', f));
    const ok = await p.getByText('Revisar datos del documento').waitFor({ timeout: 240000 }).then(() => true, () => false);
    check(`leer ${f}`, ok);
  }
  await p.goto(base + '/', { waitUntil: 'networkidle' }); await wt(1500);
  const dl = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByText('Excel', { exact: true }).first().click()]).then(([d]) => d.suggestedFilename(), () => '');
  check('exportar a Excel', /\.xlsx$/.test(dl), dl);
  check('sin bloqueos de la política de contenidos', csp.length === 0, csp.slice(0, 3).join(' | '));
  check('sin errores', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `\n${fails} fallos` : '\nOK   todo bien');
  process.exit(fails ? 1 : 0);
})();
