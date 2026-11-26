// Lector de documentos: elige la «Referencia de pedido» por el código escrito (ACM-620 → ACM y ref. ACM-620),
// no se confunde con «ESPAÑA», el formulario empieza en «Seleccionar referencia» y el documento queda visible arriba.
const { chromium } = require('playwright');
const path = require('path');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const base = process.env.BASE || `http://localhost:${process.env.PORT || 8780}`;
const OUT = process.env.OUT;
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };
const HTML = `<html><body style="font-family:Arial;font-size:13px;padding:40px">
<div style="display:flex;justify-content:space-between"><div><b>AO Gestiones S.L.</b><br>Calle Industria 4<br>08001 Barcelona<br>ESPAÑA<br>NIF B12345674</div>
<div><b>Talleres Prueba S.L.</b><br>Avenida del Puerto 22<br>46001 Valencia<br>ESPAÑA<br>NIF B98765432</div></div>
<h2>OFERTA Nº E266999</h2><p>Fecha: 10/03/2026<br>Su referencia: ACM-620</p>
<table style="width:100%;border-collapse:collapse"><tr><th align=left>Cant.</th><th align=left>Descripción</th><th align=right>Precio</th><th align=right>Importe</th></tr>
<tr><td>2</td><td>Motor eléctrico 5HP</td><td align=right>100,00</td><td align=right>200,00</td></tr></table>
<p style="text-align:right">Base imponible 200,00<br>IVA 21% 42,00<br>Total 242,00 €</p></body></html>`;
(async () => {
  const b = await chromium.launch();
  const pdf = path.join(OUT || __dirname, 'oferta-ref.pdf');
  { const pg = await b.newPage(); await pg.setContent(HTML); await pg.pdf({ path: pdf, format: 'A4' }); await pg.close(); }
  for (const [w, h, tag] of [[1440, 900, 'escritorio'], [390, 844, 'móvil']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 });
    const mock = createMock(); seed(mock.db);
    mock.db.manufacturers.push({ id: 'mesp', name: 'ESP', code: 'ESP', active_years: [2026], created_at: '2026-01-01' });
    await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
    await ctx.route('wss://**', r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const wt = ms => p.waitForTimeout(ms);
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await wt(1000);
    await p.getByTestId('login-username').fill('admin@ao-gestiones.test');
    await p.getByTestId('login-password').fill(PASSWORD);
    await p.getByTestId('login-submit').click(); await wt(2500);
    // Como en el caso real: «Nuevo pedido» desde dentro de la carpeta ESP
    await p.goto(base + '/order-form?manufacturerId=mesp&year=2026', { waitUntil: 'networkidle' }); await wt(1800);
    const sel = await p.getByTestId('manufacturer-select').innerText();
    check(`[${tag}] empieza en «Seleccionar referencia» (también desde la carpeta ESP)`, /Seleccionar referencia/.test(sel), sel);
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.getByTestId('scan-document-btn').click()]);
    await fc.setFiles(pdf);
    await p.getByText('Revisar datos del documento').waitFor({ timeout: 120000 }); await wt(800);
    const t = await p.evaluate(() => document.body.innerText);
    check(`[${tag}] revisión propone la referencia de pedido Acme (por ACM-620)`, /Elegir la referencia de pedido\s*Acme Industries/.test(t));
    check(`[${tag}] revisión propone poner ACM-620`, /Poner la referencia\s*ACM-620/.test(t));
    check(`[${tag}] no propone ESP por «ESPAÑA»`, !/referencia de pedido\s*ESP\b/.test(t));
    if (OUT) await p.screenshot({ path: `${OUT}/scan-${w}-revision.png` });
    await p.getByText('Aplicar al formulario').click(); await wt(900);
    const okb = p.getByText('OK', { exact: true }); if (await okb.count()) { await okb.last().click(); await wt(300); }
    const sel2 = await p.getByTestId('manufacturer-select').innerText();
    check(`[${tag}] formulario: Acme elegida`, /Acme Industries/.test(sel2), sel2);
    check(`[${tag}] formulario: referencia 620 con prefijo ACM-`, (await p.getByTestId('manual-ref-input').inputValue()) === '620' && (await p.getByTestId('manual-ref-prefix').innerText()).trim() === 'ACM-');
    check(`[${tag}] documento visible arriba`, await p.getByTestId('doc-preview-panel').isVisible() && (await p.getByTestId('doc-preview-page-0').count()) === 1);
    if (OUT) await p.screenshot({ path: `${OUT}/scan-${w}-formulario.png` });
    await p.getByTestId('doc-preview-page-0').click(); await wt(500);
    check(`[${tag}] se amplía al pulsar la página`, await p.getByTestId('doc-preview-close').isVisible());
    if (OUT) await p.screenshot({ path: `${OUT}/scan-${w}-ampliado.png` });
    await p.getByTestId('doc-preview-close').click(); await wt(400);
    await p.getByTestId('doc-preview-toggle').click(); await wt(300);
    check(`[${tag}] se puede ocultar`, (await p.getByTestId('doc-preview-strip').count()) === 0);
    await p.getByTestId('doc-preview-remove').click(); await wt(300);
    check(`[${tag}] se puede quitar`, (await p.getByTestId('doc-preview-panel').count()) === 0);
    await p.getByLabel('Producto', { exact: true }).first().fill('Motor eléctrico 5HP').catch(() => {});
    await p.getByTestId('submit-order-btn').click(); await wt(2500);
    const o = mock.db.orders.find(x => x.custom_reference === 'ACM-620');
    check(`[${tag}] se guarda con ACM y ACM-620`, !!o && o.manufacturer_code === 'ACM', o ? o.reference_number : 'no guardado');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`[${tag}] sin scroll horizontal`, !sw);
    check(`[${tag}] sin errores`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} fallos` : '\nOK   todo bien');
  process.exit(fails ? 1 : 0);
})();
