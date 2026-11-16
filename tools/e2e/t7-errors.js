const { boot } = require('./e2e-lib');
(async () => {
  const { b, p, wait, log } = await boot({ viewport: { width: 390, height: 844 } });
  await p.goto(`http://localhost:${process.env.PORT}/order-form`, { waitUntil: 'networkidle' }); await wait(1500);
  const pick = async f => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.getByTestId('scan-document-btn').click()]); await fc.setFiles(f); };
  for (const f of ['roto.pdf', 'notas.txt', 'blanco.png']) {
    await pick(require('path').join(__dirname, '../samples') + '/errores/' + f);
    await p.waitForFunction(() => /Reintentar|Elegir otro archivo/.test(document.body.innerText), null, { timeout: 120000 }).catch(() => {});
    const t = await p.evaluate(() => document.body.innerText);
    const m = /\n([^\n]+?)\n\s*(?:Reintentar|Elegir otro archivo)/.exec(t); // el aviso va justo antes de sus botones
    console.log(f, '→', m ? m[1] : t.slice(0, 300).replace(/\n+/g, ' | '));
    await p.screenshot({ path: `${require("path").join(__dirname, "../out")}/error-${f}.png` });
    await p.getByText('Cerrar', { exact: true }).click().catch(() => {}); await wait(300);
  }
  // Cancelar a mitad de lectura
  await pick(require('path').join(__dirname, '../samples') + '/05-factura-girada-90.jpg'); await wait(1200);
  await p.getByLabel('Cancelar lectura').click(); await wait(6000);
  const t = await p.evaluate(() => document.body.innerText);
  console.log('cancelar →', /Revisar datos del documento/.test(t) ? 'FAIL: se abrió la revisión' : /Leyendo documento/.test(t) ? 'FAIL: sigue leyendo' : 'OK: cancelado, formulario intacto');
  // Cancelar en la revisión no toca el formulario
  await pick(require('path').join(__dirname, '../samples') + '/01-factura-proveedor.pdf');
  await p.getByText('Revisar datos del documento').waitFor({ timeout: 60000 });
  await p.getByRole('button', { name: 'Cancelar y cerrar' }).click(); await wait(600);
  const vals = await p.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => i.value).join('|'));
  console.log('cancelar revisión →', /Talleres/.test(vals) ? 'FAIL: aplicó datos' : 'OK: formulario sin cambios');
  console.log(log.length ? 'CONSOLE ' + log.join('\n') : 'consola sin errores');
  await b.close();
})();
