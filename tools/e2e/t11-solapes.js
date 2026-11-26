// Comprueba que al cambiar de pantalla no se ve la anterior por debajo (pantallas con fondo transparente se solapaban)
// PORT=8780 node e2e/t11-solapes.js
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const port = process.env.PORT || 8780;
const base = process.env.BASE || `http://localhost:${port}`;
const results = [];
const check = (name, ok, extra = '') => results.push((ok ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : ''));
// ¿Hay algún texto de la lista `marks` que se vea (no tapado) en pantalla?
const visibleMarks = (p, marks) => p.evaluate(ms => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode; const t = n.textContent.trim();
    if (!ms.includes(t)) continue;
    const el = n.parentElement; const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
    // Se ve si está arriba, o si todo lo que tiene encima es transparente (sin color ni imagen de fondo)
    const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const i = stack.findIndex(x => x === el || el.contains(x));
    if (i === -1) continue;
    const covered = stack.slice(0, i).some(x => {
      if (x.contains(el)) return false;
      const cs = getComputedStyle(x);
      const bg = cs.backgroundColor;
      const opaqueColor = bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg);
      return opaqueColor || cs.backgroundImage !== 'none';
    });
    if (!covered) out.push(t);
  }
  return out;
}, marks);
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[1440, 900, 'escritorio'], [2000, 900, 'ancho'], [390, 844, 'móvil']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const mock = createMock(); seed(mock.db);
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage();
    await p.goto(base + '/?r=' + Date.now(), { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.getByTestId('login-username').fill('admin@ao-gestiones.test'); await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await p.waitForTimeout(2500);
    const PED = ['Resumen y lista', 'Todos los pedidos'], FAB = ['Crear'], AJU = ['Cerrar sesión', 'Apariencia'];
    await p.getByTestId('nav-Fabricantes').click(); await p.waitForTimeout(1200);
    check(`[${tag}] en Fabricantes no se ve Pedidos`, (await visibleMarks(p, PED)).length === 0, (await visibleMarks(p, PED)).join(','));
    await p.getByTestId('nav-Ajustes').click(); await p.waitForTimeout(1200);
    let v = await visibleMarks(p, [...PED, ...FAB]);
    check(`[${tag}] en Ajustes no se ve nada de otras pantallas`, v.length === 0, v.join(','));
    await p.getByTestId('nav-Pedidos').click(); await p.waitForTimeout(1200);
    v = await visibleMarks(p, [...FAB, ...AJU]);
    check(`[${tag}] al volver a Pedidos no se ve nada de otras pantallas`, v.length === 0, v.join(','));
    await p.locator('[data-testid^="order-row-"],[data-testid^="order-card-"]').first().click(); await p.waitForTimeout(1500);
    v = await visibleMarks(p, PED);
    check(`[${tag}] en la ficha no se ve la lista de debajo`, v.length === 0, v.join(','));
    await p.getByTestId('edit-order-btn').click(); await p.waitForTimeout(1800);
    v = await visibleMarks(p, [...PED, 'Resumen económico', 'Datos del pedido']);
    check(`[${tag}] en el formulario no se ve la ficha ni la lista`, v.length === 0, v.join(','));
    await p.screenshot({ path: `${__dirname}/../out/solapes-${tag}.png` });
    await ctx.close();
  }
  console.log(results.join('\n'));
  await b.close();
})();
