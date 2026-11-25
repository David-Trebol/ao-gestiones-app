// Fabricantes (proveedores reales) y registro por producto: alta/edición en «Fabricantes», elegir fabricante
// en cada producto, registro pedido/recibido/pagado con fechas, la lista lo muestra y el formulario lo conserva.
// También: «Fabricantes» antiguo se llama ahora «Referencias de pedido».
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const base = process.env.BASE || `http://localhost:${process.env.PORT || 8780}`;
const OUT = process.env.OUT;
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[1440, 900, 'escritorio'], [1024, 768, 'portátil'], [390, 844, 'móvil']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 });
    const mock = createMock(); seed(mock.db);
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const wt = ms => p.waitForTimeout(ms);
    const shot = async n => { if (OUT) await p.screenshot({ path: `${OUT}/fab-${w}-${n}.png` }); };
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await wt(1000);
    await p.getByTestId('login-username').fill('dvdtrebol3@gmail.com');
    await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await wt(2500);
    const body = () => p.evaluate(() => document.body.innerText);
    check(`[${tag}] menú con «Referencias» y «Fabricantes»`, /Referencias/.test(await body()) && /Fabricantes/.test(await body()));

    // Referencias de pedido (antes «Fabricantes»): mismos datos
    await p.goto(base + '/manufacturers', { waitUntil: 'networkidle' }); await wt(1500);
    check(`[${tag}] «Referencias de pedido» conserva las que había`, /Referencias de pedido/.test(await body()) && (await body()).includes(mock.db.manufacturers[0].name));

    // Fabricantes: alta
    await p.goto(base + '/suppliers', { waitUntil: 'networkidle' }); await wt(1500);
    await p.getByTestId('create-supplier-btn').first().click(); await wt(500);
    await p.getByTestId('supplier-name-input').fill('Suministros Pepito');
    await p.getByTestId('supplier-contact-input').fill('Pepito');
    await p.getByTestId('supplier-phone-input').fill('600 111 222');
    await p.getByTestId('supplier-save-btn').click(); await wt(1200);
    check(`[${tag}] se añade un fabricante`, mock.db.suppliers.some(x => x.name === 'Suministros Pepito' && x.contact === 'Pepito'));
    // duplicado
    await p.getByTestId('create-supplier-btn').first().click(); await wt(400);
    await p.getByTestId('supplier-name-input').fill('suministros pepito');
    await p.getByTestId('supplier-save-btn').click(); await wt(800);
    check(`[${tag}] no deja repetir el nombre`, mock.db.suppliers.length === 1 && await p.getByTestId('web-alert').isVisible().catch(() => false));
    await p.getByTestId('web-alert-btn-OK').click().catch(() => p.getByTestId('web-alert').getByRole('button').first().click()); await wt(300);
    await p.getByText('Cancelar', { exact: true }).last().click(); await wt(400);
    const sup = mock.db.suppliers[0];
    // edición
    await p.getByTestId('supplier-menu-' + sup.id).click(); await wt(400);
    await p.getByText('Editar datos', { exact: true }).last().click(); await wt(400);
    await p.getByTestId('supplier-email-input').fill('pedidos@pepito.es');
    await p.getByTestId('supplier-save-btn').click(); await wt(1000);
    check(`[${tag}] se edita un fabricante`, mock.db.suppliers[0].email === 'pedidos@pepito.es');
    await shot('lista');

    // Ficha: elegir fabricante del producto 0
    await p.goto(base + '/order-detail?orderId=o1', { waitUntil: 'networkidle' }); await wt(2500);
    const o1 = () => mock.db.orders.find(o => o.id === 'o1');
    const total0 = o1().total_with_vat;
    await p.getByTestId('item-supplier-0').first().click(); await wt(500);
    await p.getByText('Suministros Pepito', { exact: true }).last().click(); await wt(1200);
    check(`[${tag}] se elige el fabricante del producto`, o1().items[0].supplier_id === sup.id && o1().items[0].supplier_name === 'Suministros Pepito');
    check(`[${tag}] no cambia importes`, o1().total_with_vat === total0);

    // Registro: pedido → recibido → pagado
    await p.getByTestId('item-log-0').first().click(); await wt(700);
    check(`[${tag}] se abre el registro`, await p.getByTestId('supplier-log-sheet').isVisible());
    const add = async (type, date, note) => {
      await p.getByTestId('supplier-type-' + type).click(); await wt(150);
      await p.locator('[data-testid="supplier-log-sheet"] input[type="date"]').fill(date);
      if (note) await p.getByTestId('supplier-note-input').fill(note);
      await p.getByTestId('supplier-add-entry').click(); await wt(1000);
    };
    await add('ordered', '2026-11-03', 'Pedido nº 55');
    await add('received', '2026-11-06');
    await add('paid', '2026-11-08', 'Transferencia');
    const log = o1().items[0].supplier_log || [];
    check(`[${tag}] el registro guarda los tres apuntes con fecha`, log.length === 3 && log.map(e => e.type).join() === 'ordered,received,paid' && log[0].date === '2026-11-03' && log[0].note === 'Pedido nº 55', JSON.stringify(log.map(e => [e.type, e.date])));
    const stepTxt = await p.getByTestId('supplier-step-paid').innerText();
    check(`[${tag}] los trámites muestran la fecha`, /08\/11\/2026/.test(stepTxt), stepTxt.replace(/\n/g, ' '));
    // «Otro» sin nota no se guarda
    await p.getByTestId('supplier-type-other').click(); await p.getByTestId('supplier-add-entry').click(); await wt(600);
    check(`[${tag}] «Otro» pide una nota (aviso dentro de la ventana)`, (o1().items[0].supplier_log || []).length === 3 && await p.getByTestId('supplier-log-msg').isVisible());
    // borrar un apunte (el más reciente arriba: pagado)
    await p.getByTestId('supplier-entry-del-0').click(); await wt(400);
    await p.getByTestId('supplier-entry-confirm-0').click(); await wt(1000);
    check(`[${tag}] se puede borrar un apunte`, (o1().items[0].supplier_log || []).length === 2 && !(o1().items[0].supplier_log || []).some(e => e.type === 'paid'));
    await shot('registro');
    await p.getByTestId('supplier-log-close').click(); await wt(500);
    const logTxt = await p.getByTestId('item-log-0').first().innerText();
    check(`[${tag}] el botón del registro resume el último trámite`, /Recibido 06\/11/.test(logTxt), logTxt);

    // Producto 1: fabricante nuevo desde la ficha
    await p.getByTestId('item-supplier-1').first().click(); await wt(500);
    await p.getByText('+ Añadir fabricante nuevo', { exact: true }).last().click(); await wt(700);
    await p.getByTestId('new-supplier-input').fill('Importaciones Lola');
    await p.getByTestId('new-supplier-save').click(); await wt(1500);
    check(`[${tag}] se crea un fabricante desde el producto`, mock.db.suppliers.some(x => x.name === 'Importaciones Lola') && o1().items[1].supplier_name === 'Importaciones Lola');
    await p.getByTestId('supplier-log-close').click(); await wt(400);
    await shot('ficha');
    check(`[${tag}] la ficha muestra la referencia de pedido`, /Referencia de pedido/.test(await body()));

    // El formulario conserva fabricante y registro
    await p.getByTestId('edit-order-btn').click(); await wt(1800);
    await p.getByTestId('submit-order-btn').click(); await wt(2200);
    check(`[${tag}] editar y guardar conserva fabricante y registro`, o1().items[0].supplier_id === sup.id && (o1().items[0].supplier_log || []).length === 2);

    // Lista: fabricantes reales del pedido
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await wt(2500);
    const line = await p.getByTestId('order-suppliers-o1').first().innerText().catch(() => '');
    check(`[${tag}] la lista muestra los fabricantes del pedido`, /Suministros Pepito/.test(line) && /Importaciones Lola/.test(line), line);
    await shot('pedidos');

    // Fabricantes: recuentos
    await p.goto(base + '/suppliers', { waitUntil: 'networkidle' }); await wt(1500);
    const card = await p.getByTestId('supplier-card-' + sup.id).innerText();
    check(`[${tag}] la tarjeta cuenta productos y lo que falta por pagar`, /1\s*Productos/.test(card) && /0\s*Por recibir/.test(card) && /1\s*Por pagar/.test(card), card.replace(/\n/g, ' | '));
    // copia del pedido: mantiene el fabricante, no el registro
    const hidden = await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return e.innerText && e.children.length === 0 && Number(s.opacity) < 0.05; }).length);
    check(`[${tag}] tras animarse todo queda visible`, hidden === 0, String(hidden));
    check(`[${tag}] sin errores`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nOK   todo bien');
  process.exit(fails ? 1 : 0);
})();
