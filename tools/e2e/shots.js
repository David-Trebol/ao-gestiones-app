// node shots.js <prefijo> <puerto> [big] [paginas separadas por coma]
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const { seedBig } = require('./seedbig');
const [prefix, port, big, pagesArg] = process.argv.slice(2);
const pages = (pagesArg || 'home,detail,form,manufacturers').split(',');
const sizes = [[320, 640, 'xs'], [390, 844, 'm'], [844, 390, 'land'], [768, 1024, 't'], [1024, 768, 'l'], [1440, 900, 'd']];
(async () => {
  const b = await chromium.launch();
  const report = [];
  for (const [w, h, tag] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const mock = createMock(); (big === 'big' ? seedBig : seed)(mock.db);
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    const base = `http://localhost:${port}`;
    await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.getByTestId('login-username').fill('dvdtrebol3@gmail.com'); await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await p.waitForTimeout(2500);
    const urls = { home: '/', detail: '/order-detail?orderId=' + (big === 'big' ? 'b0' : 'o1'), form: '/order-form?editOrderId=' + (big === 'big' ? 'b0' : 'o1'), manufacturers: '/manufacturers', newform: '/order-form', settings: '/settings' };
    for (const pg of pages) {
      const scrolled = pg.endsWith('2');
      const key = scrolled ? pg.slice(0, -1) : pg;
      if (key !== 'home' || scrolled) { await p.goto(base + urls[key], { waitUntil: 'networkidle' }); }
      await p.waitForTimeout(1800);
      if (scrolled) { await p.mouse.move(w / 2, h / 2); await p.mouse.wheel(0, Math.round(h * 0.8)); await p.waitForTimeout(700); }
      const hs = await p.evaluate(() => {
        const W = window.innerWidth; const bad = [];
        document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > W + 1 && getComputedStyle(el).position !== 'fixed') { let sc = el.parentElement, clipped = false; while (sc) { const cs = getComputedStyle(sc); if (/(auto|scroll|hidden)/.test(cs.overflowX)) { const pr = sc.getBoundingClientRect(); if (pr.right <= W + 1) { clipped = true; break; } } sc = sc.parentElement; } if (!clipped) bad.push((el.textContent || el.tagName).trim().slice(0, 40)); } });
        return { scroll: document.documentElement.scrollWidth > W + 1, bad: bad.slice(0, 3) };
      });
      report.push(`${tag} ${w}x${h} ${pg}: ${hs.scroll || hs.bad.length ? 'DESBORDA ' + JSON.stringify(hs.bad) : 'ok'}`);
      await p.screenshot({ path: `${require("path").join(__dirname, "../out")}/${prefix}-${pg}-${tag}.png` });
    }
    if (errs.length) report.push(`${tag} ERRORES: ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  console.log(report.join('\n'));
  await b.close();
})();
