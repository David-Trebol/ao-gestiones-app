const { boot } = require('./e2e-lib');
const results = [];
const check = (name, ok, extra = '') => { results.push((ok ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : '')); };
(async () => {
  const { b, p, log, text, shot, wait, mock } = await boot();
  const db = () => mock.db;
  const tab = async name => { await p.getByText(name, { exact: true }).last().click(); await wait(1200); };
  // 1. Año
  await p.getByTestId('home-mode-carpetas').click(); await wait(800);
  await p.getByText('Añadir Año').click(); await wait(800);
  await p.getByTestId('year-input').fill('2026');
  await p.getByText('Añadir', { exact: true }).last().click(); await wait(1500);
  check('crear año 2026', db().years.some(y => y.year === 2026), JSON.stringify(db().years));
  // 2. Fabricantes
  await tab('Fabricantes');
  for (const [n, c] of [['Acme Industries', 'acm'], ['TechParts Global', 'TPG']]) {
    await p.getByTestId('create-manufacturer-btn').click(); await wait(700);
    await p.getByTestId('create-name-input').fill(n); await p.getByTestId('create-code-input').fill(c);
    await p.getByText('Crear', { exact: true }).last().click(); await wait(1500);
  }
  check('crear 2 fabricantes', db().manufacturers.length === 2 && db().manufacturers.some(m => m.code === 'ACM'), db().manufacturers.map(m => m.code).join(','));
  // código duplicado
  await p.getByTestId('create-manufacturer-btn').click(); await wait(700);
  await p.getByTestId('create-name-input').fill('Otro'); await p.getByTestId('create-code-input').fill('ACM');
  await p.getByText('Crear', { exact: true }).last().click(); await wait(1200);
  const t = await text();
  check('código duplicado rechazado con mensaje', /Ya existe un fabricante con el código/.test(t) && db().manufacturers.length === 2);
  const okb = p.getByText('OK', { exact: true }); if (await okb.count()) { await okb.last().click(); await wait(400); }
  await p.getByText('Cancelar', { exact: true }).last().click(); await wait(600);
  // 3. Pedido nuevo con decimales y descuento
  await tab('Pedidos');
  await p.getByTestId('home-mode-lista').click(); await wait(800);
  await p.getByTestId('new-order-btn').click(); await wait(1800);
  // validación junto a los campos
  await p.getByTestId('submit-order-btn').click(); await wait(600);
  const vt = await text();
  check('errores junto a los campos al guardar vacío', /Elige el fabricante del pedido/.test(vt) && /Escribe el nombre del producto/.test(vt) && /datos obligatorios/.test(vt));
  check('no se guarda con errores', db().orders.length === 0);
  const f = (ph, v) => p.getByLabel(ph, { exact: true }).first().fill(v);
  await f('Empresa', 'Cliente Prueba SL'); await f('NIF / CIF', 'B12345678'); await f('Email', 'cliente@prueba.es');
  await p.getByText('Acme Industries (ACM)').click();
  const yr = p.getByLabel('Año', { exact: true }).first(); await yr.fill(''); await yr.pressSequentially('2026');
  await f('Producto', 'Motor 5HP');
  const typeNum = async (ph, v) => { const el = p.getByLabel(ph, { exact: true }).first(); await el.click(); await el.press('Control+a'); await el.press('Backspace'); await el.pressSequentially(v, { delay: 40 }); };
  await typeNum('Cantidad', '2'); await typeNum('Coste unitario (fabricante)', '120,50'); await typeNum('Importe línea antes de dto.', '300'); await typeNum('Descuento %', '10'); await typeNum('IVA %', '21');
  check('se pueden escribir decimales con coma', (await p.getByLabel('Coste unitario (fabricante)', { exact: true }).first().inputValue()) === '120,50');
  const ft = await text();
  check('totales en formulario (270 sin IVA, 326,70 con IVA)', /270,00\s?€/.test(ft) && /326,70\s?€/.test(ft), ft.match(/Sin IVA:[^|]*\|[^|]*/)?.[0]);
  await shot('22-form');
  await p.getByTestId('submit-order-btn').click(); await wait(2500);
  let o = db().orders[0];
  check('pedido guardado en BD', !!o, o && o.reference_number);
  if (o) {
    check('referencia ACM-2026-001', o.reference_number === 'ACM-2026-001');
    check('importes guardados (270 / 56,7 / 326,7)', o.total_ex_vat === 270 && o.total_vat === 56.7 && o.total_with_vat === 326.7, `${o.total_ex_vat}/${o.total_vat}/${o.total_with_vat}`);
    check('coste unitario decimal 120.5', o.items[0].costo_unitario === 120.5);
    check('beneficio línea 270-241=29', o.items[0].beneficio_bruto === 29, String(o.items[0].beneficio_bruto));
    check('cliente guardado', o.customer.nombre_empresa === 'Cliente Prueba SL' && o.customer.nif === 'B12345678');
  }
  // 4. Navegar al pedido y editar
  await p.getByText('ACM-2026-001').first().click(); await wait(1500);
  await shot('23-detail');
  const dt = await text();
  check('detalle muestra total 326,70', /326,70\s?€/.test(dt));
  await p.getByTestId('edit-order-btn').click(); await wait(1800);
  await p.getByLabel('Empresa', { exact: true }).first().fill('Cliente Editado SL');
  await p.getByText('TechParts Global (TPG)').click();
  await p.getByTestId('submit-order-btn').click(); await wait(2500);
  o = db().orders[0];
  check('editar cliente', o.customer.nombre_empresa === 'Cliente Editado SL');
  check('cambiar fabricante re-numera referencia a TPG-2026-001', o.reference_number === 'TPG-2026-001' && o.manufacturer_code === 'TPG', o.reference_number);
  // 5. Duplicar desde detalle
  
  await p.getByTestId('duplicate-order-btn').click(); await wait(900); await shot('25-dup');
  await p.getByText('Duplicar', { exact: true }).last().click(); await wait(2000);
  const d2 = db().orders.find(x => x.id !== o.id);
  check('duplicar crea TPG-2026-002 pendiente sin factura', d2 && d2.reference_number === 'TPG-2026-002' && d2.status === 'pending' && d2.customer.numero_factura === '', d2 && `${d2.reference_number} ${d2.status}`);
  const seguir = p.getByText('Seguir aquí', { exact: true }); if (await seguir.count()) { await seguir.last().click(); await wait(500); }
  // 6. Borrar original y crear otro: no repetir referencia
  await p.getByTestId('more-actions-btn').click(); await wait(600);
  await p.getByText('Eliminar pedido', { exact: true }).last().click(); await wait(800);
  await p.getByText('Eliminar', { exact: true }).last().click(); await wait(2200);
  check('borrar pedido', !db().orders.some(x => x.id === o.id), 'quedan ' + db().orders.map(x => x.reference_number));
  console.log(results.join('\n'));
  console.log('\nLOG:', log.join('\n'));
  require('fs').writeFileSync(require('path').join(__dirname, '../out/state.json'), JSON.stringify(db()));
  await b.close();
})();
