// Comprueba los datos esperados de cada documento de ejemplo
import { execFileSync } from 'child_process';
const S = require('path').join(__dirname, '../samples') + '/';
const factura = { cliente: 'Talleres Martínez S.A.', nif: 'A28765436', cp: '28009', lineas: 5, base: 1364.14, suma: 1364.14, pedido: 'PC-7781' };
const cases: [string, any][] = [
  ['01-factura-proveedor.pdf', factura],
  ['04-factura-foto.png', factura],
  ['05-factura-girada-90.jpg', factura],
  ['06-factura-mala-calidad.jpg', factura],
  ['02-pedido-cliente-2-paginas.pdf', { cliente: 'Construcciones Ebro Norte S.L.', nif: 'B50998871', cp: '50016', lineas: 34, base: 96797.39, suma: 96797.39, pedido: '2026/0458' }],
  ['03-presupuesto-dos-columnas.pdf', { cliente: 'Clínica Dental Arenal SL', nif: 'B29334455', cp: '29001', lineas: 4, base: 9844, suma: 9844 }],
  ['07-presupuesto-escaneado.pdf', { cliente: 'Clínica Dental Arenal SL', nif: 'B29334455', cp: '29001', lineas: 4, base: 9844, suma: 9844 }],
];
let fails = 0;
for (const [f, exp] of cases) {
  const out = execFileSync('bun', ['run', 'run.ts', S + f], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const d = JSON.parse(out.slice(out.indexOf('{')));
  const c = d.customerIs === 'issuer' ? d.issuer : d.recipient;
  const got = { cliente: c.fields.nombre_empresa?.value, nif: c.fields.nif?.value, cp: c.fields.codigo_postal?.value, lineas: d.lines.length, base: d.totals.base?.value, suma: d.linesSum, pedido: d.refs.numero_pedido_cliente?.value };
  const bad = Object.keys(exp).filter(k => exp[k] !== (got as any)[k]);
  if (bad.length) fails++;
  console.log(`${bad.length ? 'FAIL' : 'OK  '} ${f}${bad.length ? ' → ' + bad.map(k => `${k}: esperado ${exp[k]}, leído ${(got as any)[k]}`).join('; ') : ''}`);
}
process.exit(fails ? 1 : 0);
