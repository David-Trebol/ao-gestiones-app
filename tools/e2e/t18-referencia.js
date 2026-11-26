// Referencia propia del pedido: «ACM-» fijo + número, sugerencia «Continuar con ACM-629» y año aparte «(2026)»
// en la lista, en la ficha y al guardar.
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const base = process.env.BASE || `http://localhost:${process.env.PORT || 8780}`;
const OUT = process.env.OUT;
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[1440, 900, 'escritorio'], [390, 844, 'móvil'], [320, 640, 'móvil 320']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 });
    const mock = createMock(); seed(mock.db);
    const byId = id => mock.db.orders.find(o => o.id === id);
    byId('o1').custom_reference = '628'; byId('o2').custom_reference = 'ACM-605'; byId('o4').custom_reference = 'ACM-610';
    byId('o3').custom_reference = ''; byId('o5').custom_reference = '';
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const wt = ms => p.waitForTimeout(ms);
    const shot = async n => { if (OUT) await p.screenshot({ path: `${OUT}/ref-${w}-${n}.png` }); };
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await wt(1000);
    await p.getByTestId('login-username').fill('dvdtrebol3@gmail.com');
    await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await wt(2500);

    // Lista del inicio
    await p.getByTestId('home-mode-lista').click().catch(() => {}); await wt(900);
    const r1 = await p.getByTestId('order-ref-o1').first().innerText().catch(() => '');
    const r3 = await p.getByTestId('order-ref-o3').first().innerText().catch(() => '');
    check(`[${tag}] lista: «ACM-628 (2026)»`, /ACM-628\s*\(2026\)/.test(r1), r1);
    check(`[${tag}] lista: sin referencia propia se ve la automática`, r3.trim() === 'TPG-2026-001', r3);
    await shot('lista');

    // Ficha
    await p.goto(base + '/order-detail?orderId=o1', { waitUntil: 'networkidle' }); await wt(1500);
    const hr = await p.getByTestId('hero-ref').innerText().catch(() => '');
    const hy = await p.getByTestId('hero-ref-year').innerText().catch(() => '');
    check(`[${tag}] ficha: «ACM-628» y «(2026)» aparte`, hr.trim() === 'ACM-628' && hy.trim() === '(2026)', `${hr} | ${hy}`);
    await shot('ficha');

    // Ficha sin referencia: escribir solo el número
    await p.goto(base + '/order-detail?orderId=o5', { waitUntil: 'networkidle' }); await wt(1500);
    await p.getByTestId('ref-edit').click(); await wt(400);
    const pre = await p.getByTestId('ref-prefix').innerText().catch(() => '');
    check(`[${tag}] ficha: prefijo «EUR-» fijo al editar`, pre.trim() === 'EUR-', pre);
    await p.getByTestId('ref-input').fill('12'); await p.getByTestId('ref-save').click(); await wt(1200);
    check(`[${tag}] ficha: se guarda «EUR-12»`, byId('o5').custom_reference === 'EUR-12', byId('o5').custom_reference);

    // Nuevo pedido: sugerencia del siguiente
    await p.goto(base + '/order-form', { waitUntil: 'networkidle' }); await wt(1800);
    await p.getByTestId('manufacturer-select').click(); await wt(500); await p.getByText('Acme Industries (ACM)').last().click(); await wt(500);
    const nx = p.getByTestId('manual-ref-next');
    const nxt = await nx.innerText().catch(() => '');
    check(`[${tag}] formulario: «Continuar con ACM-629» (última ACM-628)`, /Continuar con\s*ACM-629/.test(nxt) && /ACM-628/.test(nxt), nxt.replace(/\s+/g, ' '));
    await shot('form-sugerencia');
    await nx.click(); await wt(300);
    check(`[${tag}] formulario: al pulsar se rellena 629`, (await p.getByTestId('manual-ref-input').inputValue()) === '629');
    check(`[${tag}] formulario: desaparece la sugerencia`, (await nx.count()) === 0);
    const f = (l, v) => p.getByLabel(l, { exact: true }).first().fill(v);
    await f('Empresa', 'Cliente Ref SL'); await f('Producto', 'Motor prueba');
    await p.getByTestId('submit-order-btn').click(); await wt(2500);
    const nw = mock.db.orders.find(o => o.customer?.nombre_empresa === 'Cliente Ref SL');
    check(`[${tag}] se guarda «ACM-629» (la automática sigue igual)`, nw && nw.custom_reference === 'ACM-629' && /^ACM-2026-\d{3}$/.test(nw.reference_number), nw && `${nw.custom_reference} / ${nw.reference_number}`);

    // Escribir a mano otra cosa
    await p.goto(base + '/order-form', { waitUntil: 'networkidle' }); await wt(1800);
    await p.getByTestId('manufacturer-select').click(); await wt(500); await p.getByText('Acme Industries (ACM)').last().click(); await wt(500);
    await p.getByTestId('manual-ref-input').fill('628'); await wt(300);
    const dup = await p.getByTestId('manual-ref-dup').innerText().catch(() => '');
    check(`[${tag}] aviso si la referencia ya existe (ACM-628)`, /ACM-628 \(2026\) ya existe \(pedido de Construcciones García S\.A\.\)\. Revisa/.test(dup), dup);
    await shot('form-duplicada');
    await p.getByTestId('manual-ref-input').fill('700');
    await wt(300);
    check(`[${tag}] sin aviso con un número libre`, (await p.getByTestId('manual-ref-dup').count()) === 0);
    await f('Empresa', 'Cliente Manual SL'); await f('Producto', 'Bomba prueba');
    await p.getByTestId('submit-order-btn').click(); await wt(2500);
    const nm = mock.db.orders.find(o => o.customer?.nombre_empresa === 'Cliente Manual SL');
    check(`[${tag}] a mano: se guarda «ACM-700»`, nm && nm.custom_reference === 'ACM-700', nm && nm.custom_reference);

    const sw = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`[${tag}] sin scroll horizontal`, !sw);
    check(`[${tag}] sin errores`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} fallos` : '\nOK   todo bien');
  process.exit(fails ? 1 : 0);
})();
