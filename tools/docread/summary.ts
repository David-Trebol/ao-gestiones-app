// imprime un resumen compacto del resultado
import { readFileSync } from 'fs';
const d = JSON.parse(readFileSync(0, 'utf8').replace(/^[^{]*/s, ''));
const fl = (p: any) => Object.entries(p.fields).map(([k, v]: any) => `${k}=${v.value}${v.status !== 'ok' ? `(${v.status})` : ''}`).join(' · ');
console.log('TIPO', d.docType, '| cliente =', d.customerIs, d.customerConfident ? '(seguro)' : '(dudoso)', '-', d.customerReason);
console.log('EMISOR', fl(d.issuer)); console.log('DEST', d.recipient.label, '→', fl(d.recipient));
console.log('REFS', Object.entries(d.refs).map(([k, v]: any) => `${k}=${v.value}`).join(' · '), '| pago:', d.condiciones_pago?.value, '| entrega:', d.condiciones_entrega?.value);
d.lines.forEach((l: any, i: number) => console.log(` ${i + 1}. [${l.code ?? ''}] ${l.description} | q=${l.quantity} p=${l.unitPrice} d=${l.discount} net=${l.netUnitPrice} imp=${l.amount} iva=${l.vat} ${l.isShipping ? 'ENVIO' : ''} ${l.check}${l.duplicateOf !== undefined ? ' DUP' : ''}`));
console.log('TOTALES', Object.entries(d.totals).map(([k, v]: any) => `${k}=${v.value}${v.status !== 'ok' ? `(${v.status})` : ''}`).join(' · '), '| suma líneas', d.linesSum);
d.warnings.forEach((w: string) => console.log(' ⚠', w));
