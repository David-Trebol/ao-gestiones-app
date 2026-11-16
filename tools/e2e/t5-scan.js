// Prueba de la lectura local de documentos: node t5-scan.js <archivo> <ancho> <prefijo>
const { boot } = require('./e2e-lib');
(async () => {
  const [file, width = '1440', prefix = 'scan'] = process.argv.slice(2);
  const w = +width;
  const { b, p, log, wait } = await boot({ viewport: { width: w, height: w >= 1024 ? 900 : 844 } });
  const results = [];
  const ok = (name, cond) => { results.push(`${cond ? 'OK ' : 'FAIL'} ${name}`); };
  try {
    await p.goto(`http://localhost:${process.env.PORT}/order-form`, { waitUntil: 'networkidle' }); await wait(1500);
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.getByTestId('scan-document-btn').click()]);
    // Vigila la página desde antes de elegir el archivo: con PDF de texto el aviso dura menos de medio segundo
    await p.evaluate(() => {
      window.__vioProgreso = false;
      const mo = new MutationObserver(() => { if (/Leyendo documento/.test(document.body.innerText)) { window.__vioProgreso = true; mo.disconnect(); } });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    const t0 = Date.now();
    await fc.setFiles(file);
    await wait(400);
    ok('muestra progreso', await p.evaluate(() => window.__vioProgreso || /Leyendo documento/.test(document.body.innerText)));
    await p.getByText('Revisar datos del documento').waitFor({ timeout: 240000 });
    results.push(`     tiempo de lectura: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    await wait(800);
    await p.screenshot({ path: `${require("path").join(__dirname, "../out")}/${prefix}-revision.png` });
    const txt = await p.evaluate(() => document.body.innerText);
    ok('pantalla de revisión abierta', /Nada se cambia hasta que pulses/.test(txt));
    if (w < 1024) {
      await p.getByRole('tab', { name: 'Documento' }).click(); await wait(600);
      await p.screenshot({ path: `${require("path").join(__dirname, "../out")}/${prefix}-documento.png` });
      await p.getByRole('tab', { name: 'Datos extraídos' }).click(); await wait(400);
    }
    // bajar hasta las líneas y captura
    await p.getByText('Comprobación de totales').scrollIntoViewIfNeeded(); await wait(400);
    await p.screenshot({ path: `${require("path").join(__dirname, "../out")}/${prefix}-lineas.png` });
    await p.getByText('Aplicar al formulario').click(); await wait(800);
    const after = await p.evaluate(() => document.body.innerText);
    ok('aviso de aplicado', /Datos aplicados/.test(after));
    const m = /Se han aplicado ([^.]+)\./.exec(after); if (m) results.push('     ' + m[1]);
    // cerrar el aviso
    const okBtn = p.getByText('OK', { exact: true }); if (await okBtn.count()) await okBtn.first().click();
    await wait(500);
    const values = await p.evaluate(() => Array.from(document.querySelectorAll('input,textarea')).map(i => i.value).filter(Boolean));
    results.push('     valores en el formulario: ' + values.slice(0, 40).join(' | '));
    const ftxt = await p.evaluate(() => document.body.innerText);
    const money = ftxt.match(/\d{1,3}(?:\.\d{3})*,\d{2}\s?€/g) || [];
    results.push('     importes visibles en el formulario: ' + Array.from(new Set(money)).slice(-8).join(' · '));
    const labelled = await p.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => { const lab = i.parentElement?.parentElement?.querySelector('div[dir="auto"]')?.textContent || i.closest('div')?.previousElementSibling?.textContent || ''; return lab + '=' + i.value; }).filter(x => /TPV|Precio|Coste|Costo|Dto|Total/i.test(x)).slice(0, 12));
    results.push('     ' + labelled.join(' | '));
    await p.getByText('Productos', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
    await wait(400);
    await p.screenshot({ path: `${require("path").join(__dirname, "../out")}/${prefix}-formulario.png` });
  } catch (e) {
    results.push('FAIL excepción: ' + e.message.split('\n')[0]);
    await p.screenshot({ path: `${require("path").join(__dirname, "../out")}/${prefix}-error.png` });
    results.push('     ' + (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 600));
  }
  console.log(results.join('\n'));
  if (log.length) console.log('CONSOLE:', log.slice(0, 8).join('\n'));
  await b.close();
})();
