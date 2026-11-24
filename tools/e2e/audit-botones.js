// Pulsa (con toque) cada botón de cada pantalla en móvil y avisa de los que no hacen nada o dan error.
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const base = process.env.BASE || 'http://localhost:8780';
const W = +(process.env.W || 390), H = +(process.env.H || 844);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 768, hasTouch: true });
  const mock = createMock(); seed(mock.db);
  await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
  await ctx.route('wss://**', r => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  p.on('dialog', d => d.dismiss());
  await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  await p.getByTestId('login-username').fill('dvdtrebol3@gmail.com');
  await p.getByTestId('login-password').fill(PASSWORD);
  await p.getByTestId('login-submit').click(); await p.waitForTimeout(3000);
  const screens = ['/', '/order-detail?orderId=o5', '/order-form?editOrderId=o5', '/order-form', '/manufacturers', '/settings'];
  const snap = () => p.evaluate(() => location.href + '|' + document.body.innerText.length + '|' + document.querySelectorAll('[role="dialog"],[aria-modal="true"]').length + '|' + document.body.innerText.slice(0, 4000));
  for (const s of screens) {
    await p.goto(base + s, { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
    const labels = await p.evaluate(() => [...document.querySelectorAll('[role="button"],[role="tab"],[role="link"],[role="switch"],[role="checkbox"]')].filter(e => e.getBoundingClientRect().width > 0 && !e.closest('[aria-hidden="true"]')).map((e, i) => ({ i, l: (e.getAttribute('aria-label') || e.dataset.testid || e.innerText || '?').replace(/\s+/g, ' ').slice(0, 40) })));
    const dead = [], bad = [];
    for (const { i, l } of labels) {
      if (/cerrar sesión|eliminar|borrar|salir/i.test(l)) continue;
      await p.goto(base + s, { waitUntil: 'networkidle' }); await p.waitForTimeout(1300);
      const before = await snap(); const n0 = errs.length;
      const el = p.locator('[role="button"],[role="tab"],[role="link"],[role="switch"],[role="checkbox"]').filter({ visible: true }).nth(i);
      try { await el.scrollIntoViewIfNeeded({ timeout: 1500 }); await el.tap({ timeout: 2500 }); } catch (e) { bad.push(`${l} (no se puede pulsar: ${e.message.split('\n')[0].slice(0, 80)})`); continue; }
      await p.waitForTimeout(900);
      const after = await snap();
      if (errs.length > n0) bad.push(`${l} → ERROR ${errs[errs.length - 1]}`);
      else if (after === before) dead.push(l);
    }
    console.log(`\n== ${s}  (${labels.length} pulsables)`);
    if (dead.length) console.log('  sin efecto visible:', dead.join(' · '));
    if (bad.length) console.log('  PROBLEMAS:', bad.join(' · '));
  }
  console.log('\nerrores de página:', [...new Set(errs)].join(' / ') || 'ninguno');
  await b.close();
})();
