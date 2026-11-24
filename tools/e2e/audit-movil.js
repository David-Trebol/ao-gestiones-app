// Auditoría móvil con toque real (isMobile + hasTouch): barra inferior, final de cada pantalla y botones tapados.
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const base = process.env.BASE || 'http://localhost:8780';
const OUT = process.env.OUT || __dirname + '/../out';
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[390, 844], [320, 640], [844, 390]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const mock = createMock(); seed(mock.db);
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    await p.getByTestId('login-username').fill('dvdtrebol3@gmail.com');
    await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').tap(); await p.waitForTimeout(3500);
    const tag = `${w}x${h}`;
    // ¿qué hay realmente bajo el dedo en cada botón de la barra?
    const navProbe = () => p.evaluate(() => [...document.querySelectorAll('[data-testid^="nav-"]')].filter(e => e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(); const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return `${e.dataset.testid}:${at && e.contains(at) ? 'ok' : 'TAPADO por ' + (at?.dataset?.testid || at?.tagName + '.' + (at?.className || '').toString().slice(0, 40))} y=${Math.round(r.y)}-${Math.round(r.bottom)}`; }));
    console.log(`\n== ${tag}`); console.log(' nav lista:', (await navProbe()).join(' | '));
    const scrollEnd = async name => {
      const info = await p.evaluate(() => {
        const sc = [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2 && e.getBoundingClientRect().width > 0 && e.closest('[aria-hidden="true"]') === null; });
        sc.forEach(e => e.scrollTop = e.scrollHeight); window.scrollTo(0, 1e6);
        return sc.length + ' scrollers; docH=' + document.documentElement.scrollHeight + ' innerH=' + innerHeight;
      });
      await p.waitForTimeout(700);
      // elementos interactivos que quedan debajo de la barra inferior al final del scroll
      const covered = await p.evaluate(() => {
        const bar = [...document.querySelectorAll('[data-testid^="nav-"]')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
        const top = bar.length ? Math.min(...bar.map(r => r.top)) - 6 : innerHeight;
        return [...document.querySelectorAll('[role="button"],[role="link"],input,textarea,[data-testid]')].filter(e => { const r = e.getBoundingClientRect(); if (!r.width || e.closest('[aria-hidden="true"]') || (e.dataset.testid||'').startsWith('nav-')) return false; const cx = r.x + r.width / 2, cy = r.y + r.height / 2; if (cy < 0 || cy > innerHeight) return false; const at = document.elementFromPoint(cx, cy); return at && !e.contains(at) && !at.contains(e); }).map(e => (e.dataset.testid || e.getAttribute('aria-label') || e.innerText || e.tagName).toString().slice(0, 30) + '@' + Math.round(e.getBoundingClientRect().top)).slice(0, 12);
      });
      await p.screenshot({ path: `${OUT}/m-${tag}-${name}.png` });
      console.log(` ${name}: ${info}; tapados: ${covered.join(', ') || 'ninguno'}`);
    };
    await scrollEnd('pedidos');
    await p.getByTestId('nav-Fabricantes').tap().catch(e => console.log(' TAP Fabricantes falla', e.message.split('\n')[0])); await p.waitForTimeout(1500);
    console.log(' url tras Fabricantes:', p.url()); await scrollEnd('fabricantes');
    await p.getByTestId('nav-Ajustes').tap().catch(e => console.log(' TAP Ajustes falla', e.message.split('\n')[0])); await p.waitForTimeout(1500);
    console.log(' url tras Ajustes:', p.url()); await scrollEnd('ajustes');
    await p.getByTestId('nav-Pedidos').tap().catch(e => console.log(' TAP Pedidos falla', e.message.split('\n')[0])); await p.waitForTimeout(1500);
    console.log(' url tras Pedidos:', p.url());
    await p.locator('[data-testid^="order-card-"],[data-testid^="order-row-"]').first().tap(); await p.waitForTimeout(1800);
    console.log(' url ficha:', p.url(), ' nav ficha:', (await navProbe()).join(' | ')); await scrollEnd('ficha');
    await p.getByTestId('edit-order-btn').tap().catch(e => console.log(' TAP editar falla', e.message.split('\n')[0])); await p.waitForTimeout(1800);
    console.log(' url form:', p.url()); await scrollEnd('form');
    console.log(' errores:', errs.join(' / ') || 'ninguno');
    await ctx.close();
  }
  await b.close();
})();
