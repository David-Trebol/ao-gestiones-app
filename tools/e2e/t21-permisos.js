// Permisos de borrado: el administrador puede eliminar una referencia de pedido sin pedidos;
// un usuario normal no ve la opción (la base de datos tampoco le deja).
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const base = process.env.BASE || `http://localhost:${process.env.PORT || 8780}`;
let fails = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const role of ['admin', 'user']) {
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const tag = `[${role} ${w}]`;
      const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 });
      const mock = createMock(); seed(mock.db);
      mock.db.profiles[0].role = role;
      mock.db.manufacturers.push({ id: 'mvacia', name: 'Referencia Vacía', code: 'VAC', active_years: [2026], created_at: new Date().toISOString() });
      await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
      await ctx.route('wss://**', r => r.abort());
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      const wt = ms => p.waitForTimeout(ms);
      await p.goto(base + '/', { waitUntil: 'networkidle' }); await wt(800);
      await p.getByTestId('login-username').fill('admin@ao-gestiones.test');
      await p.getByTestId('login-password').fill(PASSWORD);
      await p.getByTestId('login-submit').click(); await wt(2500);
      await p.goto(base + '/manufacturers', { waitUntil: 'networkidle' }); await wt(1500);
      await p.getByTestId('manufacturer-menu-mvacia').first().click(); await wt(600);
      const opt = p.getByText('Eliminar referencia', { exact: true });
      if (role === 'admin') {
        check(`${tag} ve «Eliminar referencia»`, (await opt.count()) > 0);
        await opt.last().click(); await wt(600);
        await p.getByText('Eliminar', { exact: true }).last().click(); await wt(1500);
        check(`${tag} la referencia vacía se elimina`, !mock.db.manufacturers.some(m => m.id === 'mvacia'));
      } else {
        check(`${tag} no ve «Eliminar referencia»`, (await opt.count()) === 0);
        check(`${tag} sí ve editar y duplicar`, (await p.getByText('Duplicar referencia', { exact: true }).count()) > 0);
      }
      check(`${tag} sin errores`, errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
  }
  await b.close();
  console.log(fails ? `\n${fails} fallos` : '\nOK   todo bien');
  process.exit(fails ? 1 : 0);
})();
