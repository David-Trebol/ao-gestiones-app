// Capturas de la ficha del pedido (OUT, DARK=1, SIZES="1440x900,390x844")
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const base = process.env.BASE || 'http://localhost:8780';
const OUT = process.env.OUT || __dirname + '/../out';
const sizes = (process.env.SIZES || '1440x900,390x844').split(',').map(s => s.split('x').map(Number));
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: process.env.DARK ? 'dark' : 'light', isMobile: w < 768, hasTouch: w < 768 });
    const mock = createMock(); seed(mock.db);
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
    await p.getByTestId('login-username').fill('dvdtrebol3@gmail.com');
    await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await p.waitForTimeout(2500);
    await p.goto(base + '/order-detail?orderId=' + (process.env.ID || 'o1'), { waitUntil: 'networkidle' }); await p.waitForTimeout(2200);
    if (process.env.ACT) {
      for (const [i, lab] of [[0, 'Entregado'], [1, 'Pendiente']]) {
        await p.getByTestId('item-status-' + i).first().click(); await p.waitForTimeout(700);
        await p.locator('[role="dialog"], [aria-modal="true"]').last().getByText(lab, { exact: true }).click().catch(async () => { await p.getByText(lab, { exact: true }).last().click(); });
        await p.waitForTimeout(900);
      }
      await p.evaluate(() => { const s = [...document.querySelectorAll('*')].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2).pop(); if (s) s.scrollTop = 0; });
      await p.waitForTimeout(600);
    }
    const tag = `${process.env.DARK ? 'dark-' : ''}${w}`;
    await p.screenshot({ path: `${OUT}/ficha-${tag}.png` });
    const sc = await p.evaluate(() => { const s = [...document.querySelectorAll('*')].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2 && !e.closest('[aria-hidden="true"]')).pop(); return s ? s.scrollHeight / s.clientHeight : 1; });
    for (let i = 1; i < Math.min(Math.ceil(sc), 5); i++) {
      await p.evaluate(i => { const s = [...document.querySelectorAll('*')].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2 && !e.closest('[aria-hidden="true"]')).pop(); s.scrollTop = i * s.clientHeight * 0.85; }, i);
      await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/ficha-${tag}-${i}.png` });
    }
    if (errs.length) console.log(tag, 'errores', errs);
    await ctx.close();
  }
  await b.close();
})();
