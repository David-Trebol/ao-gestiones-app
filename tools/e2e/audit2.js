// Auditoría completa: node audit2.js <puerto> <ancho>x<alto> [big|empty|normal] [dark]
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const { seedBig } = require('./seedbig');
const [port, size, data = 'normal', theme = 'light'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const tag = `${W}-${data}${theme === 'dark' ? '-dark' : ''}`;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 700 ? 2 : 1 });
  const mock = createMock(); if (data === 'big') seedBig(mock.db); else if (data === 'normal') seed(mock.db);
  await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
  await ctx.route('wss://**', r => r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/WebSocket|realtime|ERR_FAILED|ERR_TUNNEL/.test(m.text()) && errs.push(m.text().slice(0, 200)));
  const w = ms => p.waitForTimeout(ms);
  const base = `http://localhost:${port}`;
  const shot = async n => { await w(700); await p.screenshot({ path: `${require("path").join(__dirname, "../out")}/${tag}-${n}.png` }); };
  const full = async n => { await w(700); await p.screenshot({ path: `${require("path").join(__dirname, "../out")}/${tag}-${n}-full.png`, fullPage: true }); };
  const notes = [];
  const measure = async label => notes.push(label + ': ' + JSON.stringify(await p.evaluate(() => {
    const W = innerWidth; const r = { hscroll: document.documentElement.scrollWidth > W + 1 };
    const small = []; document.querySelectorAll('[role=button],[role=link],button,a,[role=tab],[role=checkbox],[role=radio],input').forEach(el => { const b = el.getBoundingClientRect(); if (b.width && b.height && (b.width < 44 || b.height < 44) && b.width < 400) small.push(((el.getAttribute('aria-label') || el.textContent || el.tagName) + '').trim().slice(0, 24) + ` ${Math.round(b.width)}x${Math.round(b.height)}`); });
    r.smallTargets = small.length; r.smallSample = small.slice(0, 6); return r;
  })));
  await p.goto(base, { waitUntil: 'networkidle' });
  if (theme === 'dark') { await p.evaluate(() => localStorage.setItem('@ao_theme_mode', 'dark')); await p.reload({ waitUntil: 'networkidle' }); }
  await w(1500); await shot('01-login'); await measure('login');
  await p.getByTestId('login-username').fill('admin@ao-gestiones.test'); await p.getByTestId('login-password').fill(PASSWORD);
  await p.getByTestId('login-submit').click(); await w(2500);
  await shot('02-inicio'); await measure('inicio');
  await p.mouse.move(W / 2, H / 2); await p.mouse.wheel(0, H * 0.9); await shot('02b-inicio-scroll');
  await p.goto(base, { waitUntil: 'networkidle' }); await w(1500);
  await p.getByTestId('home-mode-carpetas').click(); await w(900); await shot('03-carpetas');
  if (data !== 'empty') {
    await p.getByTestId('year-folder-2026').click(); await w(900); await shot('03b-fabricantes-ano');
    const mf = p.locator('[data-testid^="manufacturer-folder-"]').first(); if (await mf.count()) { await mf.click(); await w(900); await shot('03c-pedidos-fabricante'); }
    await p.goto(base, { waitUntil: 'networkidle' }); await w(1200);
    await p.getByTestId('home-mode-lista').click(); await w(600);
    await p.getByText('Fabricante', { exact: true }).first().click(); await w(600); await shot('04-hoja-filtro'); await p.getByText('Cancelar', { exact: true }).last().click(); await w(400);
  }
  await p.goto(base + '/search', { waitUntil: 'networkidle' }); await w(1500); await shot('05-buscar-vacio');
  await p.locator('input').first().fill('a'); await w(900); await shot('05b-buscar-resultados'); await measure('buscar');
  await p.goto(base + '/manufacturers', { waitUntil: 'networkidle' }); await w(1500); await shot('06-fabricantes'); await measure('fabricantes');
  await p.getByTestId('create-manufacturer-btn').click(); await w(800); await shot('06b-crear-fabricante'); await p.keyboard.press('Escape'); await w(300);
  await p.goto(base + '/settings', { waitUntil: 'networkidle' }); await w(1500); await shot('07-ajustes'); await full('07-ajustes'); await measure('ajustes');
  if (data !== 'empty') {
    const id = data === 'big' ? 'b0' : 'o1';
    await p.goto(base + '/order-detail?orderId=' + id, { waitUntil: 'networkidle' }); await w(1800); await shot('08-detalle'); await full('08-detalle'); await measure('detalle');
    await p.getByTestId('more-actions-btn').click(); await w(600); await shot('08b-mas-acciones'); await p.getByText('Cancelar', { exact: true }).last().click(); await w(300);
    await p.goto(base + '/order-form?editOrderId=' + id, { waitUntil: 'networkidle' }); await w(1800); await shot('09-editar'); await full('09-editar'); await measure('editar');
  }
  await p.goto(base + '/order-form', { waitUntil: 'networkidle' }); await w(1800); await shot('10-nuevo');
  await p.getByTestId('submit-order-btn').click(); await w(700); await shot('10b-nuevo-errores');
  await p.goto(base + '/order-detail?orderId=nope', { waitUntil: 'networkidle' }); await w(1500); await shot('11-no-encontrado');
  console.log(tag, '\n ' + notes.join('\n ') + (errs.length ? '\n ERRORES: ' + errs.slice(0, 5).join(' | ') : ''));
  await b.close();
})();
