// Buscadores por año y por fabricante (vista «Por año y fabricante»): PORT=8780 node e2e/t12-buscadores.js
const { boot } = require('./e2e-lib');
const { seed } = require('./seed');
const results = [];
const check = (name, ok, extra = '') => results.push((ok ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : ''));
(async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const tag = viewport.width > 800 ? '[escritorio]' : '[móvil]';
    const { b, p, text, wait, mock, log } = await boot({ viewport });
    seed(mock.db);
    await p.reload({ waitUntil: 'networkidle' }); await wait(2500);
    const count = async () => (await p.locator('[data-testid^="order-row-"],[data-testid^="order-card-"]').count());
    await p.getByTestId('home-mode-carpetas').click(); await wait(800);
    // todos los años
    await p.getByTestId('search-years').fill('lopez'); await wait(600);
    let t = await text();
    check(`${tag} buscar en todos los años (sin acentos)`, (await count()) === 1 && (t.includes('PO-O2') || t.includes('ACM-2026-002')) && /1 resultado/.test(t));
    await p.getByTestId('clear-scope-search').click(); await wait(500);
    check(`${tag} borrar búsqueda vuelve a las carpetas`, (await p.locator('[data-testid^="year-folder-"]').count()) > 0);
    // un año
    await p.getByTestId('year-folder-2026').click(); await wait(800);
    await p.getByTestId('search-year').fill('compras@'); await wait(600);
    t = await text();
    const n2026 = mock.db.orders.filter(o => o.year === 2026 && /compras@/.test(o.customer.email || '')).length;
    check(`${tag} buscar en 2026 por email`, (await count()) === n2026 && n2026 > 0, `${await count()} de ${n2026}`);
    await p.getByTestId('search-year').fill('EUR-2025'); await wait(600);
    check(`${tag} buscar en 2026 no trae pedidos de 2025`, (await count()) === 0 && /Ningún pedido coincide/.test(await text()));
    await p.getByTestId('search-year').fill(''); await wait(400);
    // un fabricante
    await p.locator('[data-testid="manufacturer-folder-ACM"]').click(); await wait(800);
    const before = await count();
    await p.getByTestId('search-manufacturer').fill('ACM-2026-001'); await wait(600);
    check(`${tag} buscar dentro del fabricante por referencia`, before >= 2 && (await count()) === 1, `${before} → ${await count()}`);
    await p.getByTestId('crumb-years').click(); await wait(600);
    check(`${tag} al volver a «Años» la búsqueda se vacía`, (await p.getByTestId('search-years').inputValue()) === '');
    if (log.length) check(`${tag} sin errores en consola`, false, log.join(' | '));
    await b.close();
  }
  console.log(results.join('\n'));
})();
