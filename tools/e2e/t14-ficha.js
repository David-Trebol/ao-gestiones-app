// Ficha del pedido: editar la referencia manual con el ratón (✓ y ✗) y con Enter. PORT=8780 node e2e/t14-ficha.js
const { boot } = require('./e2e-lib');
const { seed } = require('./seed');
const results = [];
const check = (name, ok, extra = '') => results.push((ok ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : ''));
(async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const tag = viewport.width > 800 ? '[escritorio]' : '[móvil]';
    const { b, p, wait, mock, log } = await boot({ viewport });
    seed(mock.db);
    const base = `http://localhost:${process.env.PORT}`;
    await p.goto(base + '/order-detail?orderId=o1', { waitUntil: 'networkidle' }); await wait(1800);
    const ref = () => mock.db.orders.find(o => o.id === 'o1').custom_reference;
    await p.getByTestId('ref-edit').click(); await wait(400);
    await p.getByTestId('ref-input').fill('REF-RATON'); await p.getByTestId('ref-save').click(); await wait(1200);
    check(`${tag} guardar la ref. manual con ✓ (ratón)`, ref() === 'REF-RATON', ref());
    await p.getByTestId('ref-edit').click(); await wait(400);
    await p.getByTestId('ref-input').fill('NO-GUARDAR'); await p.getByTestId('ref-cancel').click(); await wait(600);
    check(`${tag} ✗ cancela sin guardar`, ref() === 'REF-RATON', ref());
    await p.getByTestId('ref-edit').click(); await wait(400);
    await p.getByTestId('ref-input').fill('REF-ENTER'); await p.keyboard.press('Enter'); await wait(1200);
    check(`${tag} guardar la ref. manual con Enter`, ref() === 'REF-ENTER', ref());
    if (log.length) check(`${tag} sin errores en consola`, false, log.join(' | '));
    await b.close();
  }
  console.log(results.join('\n'));
})();
