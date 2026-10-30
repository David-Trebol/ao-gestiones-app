/**
 * Interpretación de documentos comerciales con REGLAS (sin IA).
 * Entrada: líneas con posición (de PDF.js o del OCR). Salida: datos + origen + avisos.
 * Principio: si un dato no aparece claro, NO se rellena; se marca como dudoso o ausente.
 */
import {
  DocLine,
  DocType,
  Field,
  ParseContext,
  ParsedDoc,
  ParsedLine,
  Party,
  Cell,
} from './types';
import { NumToken, close, findDates, findNumbers, round2 } from './numbers';
import { findTaxIds, matchCountry, matchProvince, provinceFromPostalCode, stripAccents } from './spain';

const norm = (s: string) => stripAccents(s.toLowerCase()).replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- patrones

const TOTALS_RE =
  /\b(base\s+imponible|subtotal|sub-total|suma\s+(?:y\s+sigue|total)?|total(?:es)?\b|importe\s+(?:neto|total|bruto)|neto\s+a\s+pagar|cuota\s+(?:de\s+)?iva|recargo\s+(?:de\s+)?equivalencia|retenci[oó]n|i\.?r\.?p\.?f|tax\s+base|net\s+amount|grand\s+total|amount\s+due|vencimientos?|forma\s+de\s+pago|observaciones|notas?:)/i;

const HEADER_KEYS: { role: Role | 'desc' | 'code'; re: RegExp }[] = [
  { role: 'desc', re: /descripci|concepto|art[ií]culo|producto|denominaci|detalle|designaci|description|item\b|material/i },
  { role: 'code', re: /^(ref\.?|referencia|c[oó]d\.?|c[oó]digo|code|sku|modelo|art\.?)$/i },
  { role: 'qty', re: /^(cant\.?|cantidad|uds\.?|unid\.?|unidades|u\.?|qty|quantity|und\.?|n[ºo]\s*uds|ctd\.?)$/i },
  { role: 'price', re: /precio|p\.?\s?unit|pvp|tarifa|price|importe\s+unit|€\/u|unit\s+price|p\.?\s?u\.?$/i },
  { role: 'disc', re: /^(dto\.?|desc\.?|descuento|%\s?dto\.?|dto\s?%|%\s?desc\.?|discount|bonif\.?)/i },
  { role: 'net', re: /p\.?\s?neto|precio\s+neto|neto\s+unit|net\s+price/i },
  { role: 'vat', re: /^(%?\s?iva\s?%?|vat\s?%?|tipo\s+iva|i\.v\.a\.?)$/i },
  { role: 'amount', re: /^(importe|total|subtotal|amount|neto|importe\s+neto|total\s+l[ií]nea|valor|base|total\s+neto|importe\s+€|total\s+€)$/i },
];

type Role = 'qty' | 'price' | 'disc' | 'net' | 'vat' | 'amount';

const SHIPPING_RE = /\b(portes?|transporte|env[ií]o|gastos\s+de\s+env|shipping|freight|mensajer[ií]a|log[ií]stica|embalaje|paqueter[ií]a)\b/i;

const CLIENT_ANCHOR =
  /^(datos\s+del\s+cliente|datos\s+de\s+facturaci[oó]n|cliente|client|customer|destinatario|facturar\s+a|factura\s+a|bill\s+to|sold\s+to|comprador|raz[oó]n\s+social\s+cliente|sr\.?\s?\/?\s?sres\.?|sres\.?)\b\s*[:.]?/i;
const SHIPTO_ANCHOR = /^(enviar\s+a|ship\s+to|direcci[oó]n\s+de\s+(?:entrega|env[ií]o)|lugar\s+de\s+entrega|entregar\s+en|deliver\s+to|consignatario)\b\s*[:.]?/i;
const SUPPLIER_ANCHOR = /^(proveedor|supplier|vendor|datos\s+del\s+proveedor|a\s+la\s+atenci[oó]n\s+de\s+proveedor)\b\s*[:.]?/i;

const STREET_RE =
  /^(c\/|c\.\s|calle|cl\.?\s|avda\.?|av\.|avenida|pza\.?|plaza|pl\.\s|paseo|p[ºo]\.?\s|ctra\.?|carretera|camino|cno\.?|pol[ií]gono|pol\.?\s|p\.\s?i\.?|ronda|traves[ií]a|r[uú]a|v[ií]a\s|gran\s+v[ií]a|urb\.?|urbanizaci[oó]n|parque|parcela|nave|apartado|apdo\.?|pasaje|glorieta|bulevar|carrer|c\/\.|rambla|passeig|pg\.?|edificio|edif\.?|local|street|st\.|road|rue|via\s)/i;

const ADDRESS_EXTRA_RE = /^(piso|planta|puerta|nave|local|oficina|bajo|esc\.?|escalera|portal|bloque|km|n[ºo°]\s*\d)/i;

const LEGAL_FORM_RE = /\b(s\.?\s?l\.?\s?u?\.?|s\.?\s?a\.?\s?u?\.?|s\.?\s?l\.?\s?l\.?|s\.?\s?c\.?\s?p\.?|s\.?\s?coop\.?|c\.?\s?b\.?|sociedad|limitada|an[oó]nima|gmbh|ltd\.?|llc|inc\.?|s\.?r\.?l\.?|s\.?a\.?s\.?|lda\.?|bv|nv|ag)\s*$/i;

const DOC_TITLES: { type: DocType; re: RegExp }[] = [
  { type: 'proforma', re: /\b(factura\s+pro-?\s?forma|proforma|pro-forma\s+invoice)\b/i },
  { type: 'confirmacion', re: /\b(confirmaci[oó]n\s+de\s+pedido|order\s+confirmation|acuse\s+de\s+pedido)\b/i },
  { type: 'albaran', re: /\b(albar[aá]n|nota\s+de\s+entrega|delivery\s+note)\b/i },
  { type: 'factura', re: /\b(factura|invoice|fra\.)\b/i },
  { type: 'oferta', re: /\b(presupuesto|oferta|cotizaci[oó]n|quotation|quote)\b/i },
  { type: 'pedido', re: /\b(pedido|orden\s+de\s+compra|hoja\s+de\s+pedido|nota\s+de\s+pedido|purchase\s+order|order)\b/i },
];


// ---------------------------------------------------------------- utilidades

function f<T = string>(value: T, line: DocLine | undefined, status: Field['status'] = 'ok', note?: string): Field<T> {
  return { value, status, source: line?.text.trim(), page: line?.page, note };
}

function medianHeight(lines: DocLine[]): number {
  const hs = lines.map(l => l.h).filter(h => h > 0).sort((a, b) => a - b);
  return hs.length ? hs[Math.floor(hs.length / 2)] : 12;
}

/** Valor después de una etiqueta en la misma línea, o en la línea/celda de debajo. */
function valueAfterLabel(
  lines: DocLine[],
  idx: number,
  labelRe: RegExp,
  valueRe = /([A-Z0-9][A-Z0-9\-\/._]*\d[A-Z0-9\-\/._]*|\d[A-Z0-9\-\/._]*)/i,
): { value: string; line: DocLine } | null {
  const line = lines[idx];
  for (const cell of line.cells.length ? line.cells : [{ text: line.text, x0: 0, x1: 0 }]) {
    const m = labelRe.exec(cell.text);
    if (!m) continue;
    const after = cell.text
      .slice(m.index + m[0].length)
      .replace(/^[\s:.\-#ºª°]*(?:(?:n[ºo°.]?|n[uú]m(?:ero)?\.?|no\.?|number|nr\.?|ref\.?)\s*)?[\s:.\-#ºª°]*/i, '');
    const vm = valueRe.exec(after);
    if (vm && vm.index <= 2) return { value: vm[1].replace(/[.,;:]$/, ''), line };
    // valor en la celda siguiente de la misma línea
    const ci = line.cells.indexOf(cell as Cell);
    if (ci >= 0 && ci + 1 < line.cells.length) {
      const next = line.cells[ci + 1].text.replace(/^[\s:.\-#ºª°]*(?:n[ºo°.]?\s*)?/i, '');
      const vm2 = valueRe.exec(next);
      if (vm2 && vm2.index <= 1) return { value: vm2[1].replace(/[.,;:]$/, ''), line };
    }
    // valor en la línea de debajo, en la misma columna
    const below = lines[idx + 1];
    if (below && below.page === line.page && below.y - line.y < line.h * 2.6) {
      const c = (cell as Cell).x1 ? below.cells.find(bc => overlap(bc, cell as Cell)) : below.cells[0];
      const txt = c ? c.text : below.text;
      const vm3 = valueRe.exec(txt.trim());
      if (vm3 && vm3.index === 0) return { value: vm3[1].replace(/[.,;:]$/, ''), line: below };
    }
  }
  return null;
}

function overlap(a: Cell, b: Cell): boolean {
  return Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > -4;
}

// ---------------------------------------------------------------- partes (emisor / cliente)

function emptyParty(): Party {
  return { block: [], fields: {} };
}

interface BlockLine {
  text: string;
  line: DocLine;
}

const CONTACT_RE = /^(att\.?|a\/a|a\.?\s?a\.?|atenci[oó]n(?:\s+de)?|attn\.?|contacto|persona\s+de\s+contacto|contact|sr\.?|sra\.?|d\.\s|d[ñn]a\.?|don\s|do[ñn]a\s)\s*[:.]?\s*/i;
const DEPT_RE = /^(dpto\.?|depto\.?|departamento|dept\.?|department)\s*[:.]?\s*/i;
const PHONE_LABEL_RE = /(tel[eé]fono|tel[fé]?\.?|tlf\.?|tfno\.?|telf\.?|m[oó]vil|m[oó]v\.?|phone|ph\.?|t\.)\s*[:.]?\s*/i;
const PHONE_RE = /(?:\+|00)?(?:34[\s.\-]?)?(?:[6789]\d{2}[\s.\-]?\d{2,3}[\s.\-]?\d{2,3}[\s.\-]?\d{0,3})/g;
const EMAIL_RE = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi;
const WEB_RE = /\b(www\.[^\s]+|https?:\/\/[^\s]+)/i;
const REF_LABEL_LINE =
  /^(n[ºo°.]?\s|n[uú]m|fecha|date|factura|pedido|oferta|presupuesto|proforma|albar[aá]n|p[aá]gina|page|ref|su\s|vuestro|nuestro|forma\s+de\s+pago|vencimiento|c[oó]digo\s+cliente|cliente\s+n|agente|comercial|documento|serie)/i;

function cleanPhone(s: string): string {
  return s.replace(/[^\d+]/g, '').replace(/^0034/, '+34');
}

function parseParty(block: BlockLine[], warnings: string[], who: string): Party {
  const p = emptyParty();
  p.block = block.map(b => b.text);
  p.page = block[0]?.line.page;
  const used = new Set<number>();
  const phones: { v: string; line: DocLine; mobile: boolean }[] = [];

  block.forEach((b, i) => {
    let t = b.text;
    // email
    const emails = t.match(EMAIL_RE);
    if (emails && !p.fields.email) {
      p.fields.email = f(emails[0].toLowerCase(), b.line);
      used.add(i);
    }
    // NIF
    const ids = findTaxIds(t);
    if (ids.length && !p.fields.nif) {
      const id = ids[0];
      p.fields.nif = f(
        id.clean,
        b.line,
        id.valid === false ? 'doubtful' : 'ok',
        id.valid === false ? 'La letra o dígito de control no cuadra: revisa si está bien leído.' : undefined,
      );
      if (ids.length > 1) warnings.push(`${who}: hay más de un NIF en el bloque (${ids.map(x => x.clean).join(', ')}).`);
      used.add(i);
    }
    // teléfonos (no fax)
    const noFax = t.replace(/fax\.?\s*[:.]?\s*[+\d\s.\-()]{9,}/gi, ' ');
    const hasPhoneLabel = PHONE_LABEL_RE.test(noFax);
    const nums = (noFax.match(PHONE_RE) || []).map(cleanPhone).filter(x => x.replace(/^\+?34/, '').length === 9);
    if (nums.length && (hasPhoneLabel || nums[0].length >= 9) && !ids.some(id => nums.includes(id.clean.replace(/\D/g, '')))) {
      for (const n of nums) phones.push({ v: n, line: b.line, mobile: /^(\+34)?[67]/.test(n) });
      if (hasPhoneLabel || /^[\s+()\d.\-]+$/.test(noFax.replace(PHONE_LABEL_RE, ''))) used.add(i);
    }
    if (/^fax\b/i.test(t.trim())) used.add(i);
    if (WEB_RE.test(t) && t.replace(WEB_RE, '').trim().length < 4) used.add(i);
    // contacto
    const cm = CONTACT_RE.exec(t.trim());
    if (cm && !p.fields.contacto) {
      const v = t.trim().slice(cm[0].length).replace(EMAIL_RE, '').replace(PHONE_LABEL_RE, '').replace(/[\d+]{9,}.*/, '').trim();
      if (/[a-záéíóúñ]{2}/i.test(v)) {
        p.fields.contacto = f(v, b.line);
        used.add(i);
      }
    }
    const dm = DEPT_RE.exec(t.trim());
    if (dm && !p.fields.departamento) {
      p.fields.departamento = f(t.trim().slice(dm[0].length).trim(), b.line);
      used.add(i);
    }
    // CP + población (+ provincia)
    const cpm = /(?:^|[\s,\-])(?:E-|ES-)?((?:0[1-9]|[1-4]\d|5[0-2])\d{3})\s*[,\-]?\s+([A-ZÁÉÍÓÚÑÜa-záéíóúñü][^\d]{1,60})$/.exec(t.trim());
    if (cpm && !p.fields.codigo_postal) {
      const cp = cpm[1];
      p.fields.codigo_postal = f(cp, b.line);
      let rest = cpm[2].trim();
      let prov: string | null = null;
      const paren = /\(([^)]+)\)\s*$/.exec(rest);
      if (paren) {
        prov = matchProvince(paren[1]) ?? paren[1].trim();
        rest = rest.slice(0, paren.index).trim();
      } else {
        const parts = rest.split(/\s*[-–,\/]\s*/);
        if (parts.length > 1) {
          const maybe = matchProvince(parts[parts.length - 1]) || matchCountry(parts[parts.length - 1]);
          if (maybe) {
            if (matchCountry(parts[parts.length - 1])) p.fields.pais = f(maybe, b.line);
            else prov = maybe;
            rest = parts.slice(0, -1).join(', ');
          }
        }
      }
      const country = matchCountry(rest.split(/\s*,\s*/).pop() || '');
      if (country) {
        p.fields.pais = f(country, b.line);
        rest = rest.split(/\s*,\s*/).slice(0, -1).join(', ');
      }
      // ¿la población es a la vez provincia?
      const lead = /(?:^|\s)(?:E-)?\d{5}/.exec(t.trim());
      // si delante del CP hay una dirección en la misma línea
      if (lead && lead.index > 3 && !p.fields.direccion_1) {
        const before = t.trim().slice(0, lead.index).replace(/[,\-\s]+$/, '');
        if (/[a-z]/i.test(before)) p.fields.direccion_1 = f(before, b.line);
      }
      if (rest) p.fields.poblacion = f(rest.replace(/[.,]$/, ''), b.line);
      if (prov) p.fields.provincia = f(prov, b.line);
      else {
        const fromCity = matchProvince(rest);
        const fromCp = provinceFromPostalCode(cp);
        if (fromCity) p.fields.provincia = f(fromCity, b.line);
        else if (fromCp)
          p.fields.provincia = f(fromCp, b.line, 'derived', `Deducida del código postal ${cp}.`);
      }
      used.add(i);
    }
    // país en línea sola
    const ct = matchCountry(t);
    if (ct) {
      p.fields.pais = f(ct, b.line);
      used.add(i);
    }
    // provincia en línea sola
    if (!p.fields.provincia || p.fields.provincia.status === 'derived') {
      const pv = matchProvince(t.replace(/[()]/g, ''));
      if (pv && t.trim().length < 30) {
        p.fields.provincia = f(pv, b.line);
        used.add(i);
      }
    }
    // dirección
    if (STREET_RE.test(t.trim()) && !used.has(i)) {
      if (!p.fields.direccion_1) p.fields.direccion_1 = f(t.trim().replace(/[,]$/, ''), b.line);
      else if (!p.fields.direccion_2) p.fields.direccion_2 = f(t.trim(), b.line);
      used.add(i);
    } else if (ADDRESS_EXTRA_RE.test(t.trim()) && p.fields.direccion_1 && !p.fields.direccion_2 && !used.has(i)) {
      p.fields.direccion_2 = f(t.trim(), b.line);
      used.add(i);
    }
    t = t.trim();
    if (REF_LABEL_LINE.test(t) || /^(nif|cif|n\.i\.f|c\.i\.f|vat|dni)\b/i.test(t)) used.add(i);
  });

  // nombre: línea con forma jurídica; si no, la primera línea libre del bloque
  const free = block.map((b, i) => ({ ...b, i })).filter(b => !used.has(b.i) && /[a-záéíóúñ]{2}/i.test(b.text));
  const legal = free.find(b => LEGAL_FORM_RE.test(b.text.trim().replace(/[,.]$/, '') + ' ') || LEGAL_FORM_RE.test(b.text.trim()));
  const nameLine = legal ?? free[0];
  if (nameLine) {
    const name = nameLine.text.trim().replace(/^(raz[oó]n\s+social|nombre|empresa|company)\s*[:.]?\s*/i, '');
    p.fields.nombre_empresa = f(name, nameLine.line, legal ? 'ok' : 'doubtful', legal ? undefined : 'Sin forma jurídica (S.L., S.A.…): confirma que es el nombre de la empresa.');
    used.add(nameLine.i);
  }
  // Una dirección sin palabra clave (ej. "Mayor 12, 2ºB") justo antes del CP
  if (!p.fields.direccion_1 && p.fields.codigo_postal) {
    const cpIdx = block.findIndex(b => b.text.includes(p.fields.codigo_postal!.value));
    const prev = block[cpIdx - 1];
    if (prev && !used.has(cpIdx - 1) && /\d/.test(prev.text) && /[a-z]{2}/i.test(prev.text)) {
      p.fields.direccion_1 = f(prev.text.trim(), prev.line, 'doubtful', 'Parece la dirección (línea anterior al código postal).');
      used.add(cpIdx - 1);
    }
  }
  if (phones.length) {
    p.fields.telefono_1 = f(phones[0].v, phones[0].line);
    const second = phones.find(x => x.v !== phones[0].v);
    if (second) p.fields.telefono_2 = f(second.v, second.line);
  }
  return p;
}

// ---------------------------------------------------------------- tabla de líneas

interface Header {
  idx: number;
  line: DocLine;
  roles: { role: Role | 'desc' | 'code'; x0: number; x1: number }[];
}

function detectHeader(line: DocLine): Header['roles'] | null {
  const cells = line.cells.length ? line.cells : [{ text: line.text, x0: 0, x1: 0 }];
  const roles: Header['roles'] = [];
  // Algunas cabeceras vienen en una sola celda: separarlas por palabras clave
  const parts: Cell[] = [];
  for (const c of cells) {
    const words = c.text.split(/\s{2,}|\t/);
    if (words.length > 1 && c.x1 > c.x0) {
      const w = (c.x1 - c.x0) / c.text.length;
      let pos = 0;
      for (const word of words) {
        const at = c.text.indexOf(word, pos);
        parts.push({ text: word, x0: c.x0 + at * w, x1: c.x0 + (at + word.length) * w });
        pos = at + word.length;
      }
    } else parts.push(c);
  }
  for (const c of parts) {
    const t = c.text.trim();
    if (!t) continue;
    // varias etiquetas en una celda separadas por un espacio ("Cant. Precio Importe")
    const tokens = t.split(/\s+(?=(?:cant|uds|precio|p\.\s?unit|dto|desc|importe|total|iva|ref|c[oó]d|neto|pvp|qty|price|amount)\b)/i);
    const w = c.x1 > c.x0 ? (c.x1 - c.x0) / Math.max(1, t.length) : 0;
    let pos = 0;
    for (const tok of tokens) {
      const at = t.indexOf(tok, pos);
      pos = at + tok.length;
      const tt = tok.trim();
      const hit = HEADER_KEYS.find(k => k.re.test(tt));
      if (hit) roles.push({ role: hit.role, x0: c.x0 + at * w, x1: c.x0 + (at + tt.length) * w });
    }
  }
  const set = new Set(roles.map(r => r.role));
  const numeric = roles.filter(r => r.role !== 'desc' && r.role !== 'code').length;
  if ((set.has('desc') && numeric >= 1) || numeric >= 3) {
    if (TOTALS_RE.test(line.text) && !set.has('desc') && numeric < 3) return null;
    return roles;
  }
  return null;
}

const TEMPLATES: Role[][] = [
  ['amount'],
  ['qty', 'amount'],
  ['price', 'amount'],
  ['qty', 'price'],
  ['qty', 'price', 'amount'],
  ['price', 'qty', 'amount'],
  ['price', 'disc', 'amount'],
  ['qty', 'price', 'disc', 'amount'],
  ['price', 'qty', 'disc', 'amount'],
  ['qty', 'price', 'amount', 'vat'],
  ['qty', 'price', 'vat', 'amount'],
  ['qty', 'price', 'disc', 'net', 'amount'],
  ['qty', 'price', 'disc', 'vat', 'amount'],
  ['qty', 'price', 'disc', 'amount', 'vat'],
  ['qty', 'price', 'net', 'amount'],
  ['qty', 'price', 'disc', 'net', 'vat', 'amount'],
];

function subsequences<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      acc.push(arr[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  if (k <= arr.length && arr.length <= 9) rec(0, []);
  return out;
}

interface Assign {
  qty: number | null;
  price: number | null;
  disc: number | null;
  net: number | null;
  vat: number | null;
  amount: number | null;
  score: number;
  consistent: boolean;
}

function evaluate(roles: Role[], toks: NumToken[], useAlt: boolean[], headerOrder: Role[] | null): Assign {
  const a: Assign = { qty: null, price: null, disc: null, net: null, vat: null, amount: null, score: 0, consistent: false };
  roles.forEach((r, i) => {
    const t = toks[i];
    const v = useAlt[i] && t.alt !== undefined ? t.alt : t.value;
    (a as unknown as Record<string, number | null>)[r] = v;
    if (r === 'disc' || r === 'vat') a.score += t.percent ? 2 : 0;
    else if (t.percent) a.score -= 6;
    if (useAlt[i]) a.score -= 1;
  });
  if (a.qty !== null) {
    if (a.qty <= 0) a.score -= 5;
    if (Number.isInteger(a.qty)) a.score += 1;
    else if (Math.abs(a.qty * 1000 - Math.round(a.qty * 1000)) > 1e-6) a.score -= 2;
  }
  if (a.disc !== null && (a.disc < 0 || a.disc >= 100)) a.score -= 10;
  if (a.vat !== null && ![0, 4, 5, 7, 10, 12, 13, 19, 20, 21, 22, 23].includes(a.vat)) a.score -= 6;
  const q = a.qty ?? 1;
  const d = a.disc ?? 0;
  if (a.price !== null && a.amount !== null) {
    const candidates = [q * a.price * (1 - d / 100)];
    if (a.qty === null) candidates.push(a.price);
    if (candidates.some(c => close(c, a.amount!))) {
      a.consistent = true;
      a.score += a.qty !== null ? 12 : 6;
    } else if (a.qty !== null && close(a.price * q, a.amount)) {
      // el importe es antes de descuento
      a.consistent = true;
      a.score += 8;
    } else a.score -= 4;
  }
  if (a.net !== null && a.price !== null) {
    if (close(a.price * (1 - d / 100), a.net)) a.score += 4;
    if (a.amount !== null && close(a.net * q, a.amount)) {
      a.consistent = true;
      a.score += 6;
    }
  }
  if (a.qty !== null && a.amount !== null && a.price === null && a.net === null) a.score -= 1;
  if (headerOrder) {
    // premiar que respete la cabecera
    const sub = roles.every((r, i) => i === 0 || headerOrder.indexOf(r) > headerOrder.indexOf(roles[i - 1]));
    if (sub && roles.every(r => headerOrder.includes(r))) a.score += 5;
  }
  return a;
}

function solveRow(toks: NumToken[], headerOrder: Role[] | null): Assign | null {
  const n = toks.length;
  if (!n) return null;
  const roleSets: Role[][] = TEMPLATES.filter(t => t.length === n);
  if (headerOrder) for (const s of subsequences(headerOrder, n)) roleSets.push(s);
  if (!roleSets.length) return null;
  let best: Assign | null = null;
  const altIdx = toks.map((t, i) => (t.alt !== undefined ? i : -1)).filter(i => i >= 0);
  const altCombos: boolean[][] = [toks.map(() => false)];
  if (altIdx.length && altIdx.length <= 3) {
    for (let mask = 1; mask < 1 << altIdx.length; mask++) {
      const c = toks.map(() => false);
      altIdx.forEach((ti, b) => {
        if (mask & (1 << b)) c[ti] = true;
      });
      altCombos.push(c);
    }
  }
  for (const roles of roleSets) {
    for (const alt of altCombos) {
      const a = evaluate(roles, toks, alt, headerOrder);
      if (!best || a.score > best.score) best = a;
    }
  }
  return best;
}

const CODE_RE = /^(?=[A-Z0-9.\-\/_]*\d)[A-Z0-9][A-Z0-9.\-\/_]{2,24}$/i;

function parseRow(line: DocLine, headerOrder: Role[] | null, header: Header | null): (Omit<ParsedLine, 'isShipping' | 'check'> & { consistent: boolean; splitNote?: string }) | null {
  const text = line.text;
  const nums = findNumbers(text);
  // números al final de la línea (la "cola" numérica)
  // Posición de cada celda dentro de line.text (unidas con "   ")
  const spans: { s: number; e: number; letters: boolean }[] = [];
  {
    let pos = 0;
    for (const c of line.cells) {
      const s = text.indexOf(c.text, pos);
      if (s < 0) break;
      spans.push({ s, e: s + c.text.length, letters: /\p{L}{2}/u.test(c.text.replace(/\b(eur|uds?|unid|ud)\b\.?/gi, '')) });
      pos = s + c.text.length;
    }
  }
  const inLetterCell = (t: NumToken) => spans.length > 1 && spans.some(sp => t.start >= sp.s && t.end <= sp.e && sp.letters);
  const tail: NumToken[] = [];
  let cut = text.length;
  for (let i = nums.length - 1; i >= 0; i--) {
    const between = text.slice(nums[i].end, cut);
    if (!inLetterCell(nums[i]) && /^[\s€%|:x*]*(?:eur|uds?\.?|unid\.?|u\.)?[\s€%|]*$/i.test(between)) {
      tail.unshift(nums[i]);
      cut = nums[i].start;
    } else break;
  }
  let head = text.slice(0, cut).trim();
  // Un número pegado al final de la descripción puede ser la cantidad (columnas montadas)
  let glued: NumToken | null = null;
  {
    const lastNum = nums.filter(n => n.end <= cut).pop();
    if (lastNum && /^\s*$/.test(text.slice(lastNum.end, cut)) && /\s$/.test(text.slice(0, lastNum.start)) && !lastNum.percent) glued = lastNum;
    else {
      // dígitos pegados a la última palabra ("galvanizado100")
      const m = /(\p{L})(\d{1,5})\s*$/u.exec(text.slice(0, cut));
      if (m && header) {
        const start = m.index + 1;
        glued = { value: Number(m[2]), raw: m[2], start, end: start + m[2].length, percent: false, currency: false };
      }
    }
  }
  // Línea solo de texto dentro de la columna de descripción → no tiene importes
  if (header && line.cells.length) {
    const numericCols = header.roles.filter(r => r.role !== 'desc' && r.role !== 'code' && r.x1 > r.x0);
    const firstNumX = numericCols.length ? Math.min(...numericCols.map(r => r.x0)) : Infinity;
    const lastCell = line.cells[line.cells.length - 1];
    if (Number.isFinite(firstNumX) && lastCell.x1 < firstNumX - 4) {
      tail.length = 0;
      glued = null;
      head = text.trim();
    }
  }
  let lead: NumToken | null = null;
  // cantidad al principio de la línea ("2  Tornillo M8 …")
  const leadM = /^(\d+(?:[.,]\d+)?)\s{1,}(?=\S)/.exec(head);
  if (leadM && headerOrder && header && header.roles[0]?.role === 'qty') {
    const p = findNumbers(leadM[1])[0];
    if (p) {
      lead = p;
      head = head.slice(leadM[0].length).trim();
    }
  }
  let code: string | undefined;
  // código por columna de la cabecera
  if (header) {
    const codeCol = header.roles.find(r => r.role === 'code');
    const descCol = header.roles.find(r => r.role === 'desc');
    if (codeCol && line.cells.length > 1) {
      const c = line.cells.find(cc => cc.x0 < (descCol ? descCol.x0 - 2 : codeCol.x1 + 40) && overlap(cc, { text: '', x0: codeCol.x0 - 30, x1: codeCol.x1 + 30 }));
      if (c && CODE_RE.test(c.text.trim().split(/\s+/)[0])) {
        code = c.text.trim().split(/\s+/)[0];
      }
    }
  }
  const words = head.split(/\s+/);
  if (!code && words.length > 1 && CODE_RE.test(words[0]) && /\d/.test(words[0]) && !/^\d+([.,]\d+)?$/.test(words[0])) {
    code = words[0];
  }
  if (code && head.startsWith(code)) head = head.slice(code.length).trim();
  head = head.replace(/^[\s|:\-–·]+|[\s|:\-–·]+$/g, '').replace(/\s{2,}/g, ' ');
  if (!/[a-záéíóúñ]{2}/i.test(head) && !code) return null;
  const toks = lead ? [lead, ...tail] : tail;
  let a = solveRow(toks.slice(-7), headerOrder);
  // El OCR a veces junta dos columnas ("1  1.250,00" → "11.250,00"). Solo se separa si las cuentas cuadran.
  let splitNote: string | undefined;
  if (!a || !a.consistent) {
    outer: for (let i = 0; i < toks.length; i++) {
      const raw = toks[i].raw.trim();
      const m = /^(\d+)([.,'].*)?$/.exec(raw);
      if (!m || m[1].length < 2) continue;
      for (let k = 1; k <= Math.min(3, m[1].length - 1); k++) {
        const left = raw.slice(0, k);
        const right = raw.slice(k);
        if (/^0\d/.test(right)) continue;
        const L = findNumbers(left)[0];
        const R = findNumbers(right)[0];
        if (!L || !R || R.raw.trim() !== right) continue;
        const cand = [...toks.slice(0, i), { ...L, start: toks[i].start, end: toks[i].start + k }, { ...R, start: toks[i].start + k, end: toks[i].end }, ...toks.slice(i + 1)];
        const b = solveRow(cand.slice(-7), headerOrder);
        if (b && b.consistent) {
          a = b;
          splitNote = `Se ha leído «${raw}» como dos números (${left} y ${right}) porque así cuadran las cuentas: compruébalo.`;
          break outer;
        }
      }
    }
  }
  if (glued && ((!a || !a.consistent) || (headerOrder && headerOrder.length > toks.length && a.qty === null))) {
    const b = solveRow([glued, ...toks].slice(-7), headerOrder);
    if (b && b.consistent && (!a || !a.consistent || b.qty !== null)) {
      a = b;
      head = head.slice(0, head.lastIndexOf(glued.raw.trim())).trim();
    }
  }
  return {
    code,
    description: head,
    quantity: a?.qty ?? null,
    unitPrice: a?.price ?? null,
    discount: a?.disc ?? null,
    netUnitPrice: a?.net ?? null,
    amount: a?.amount ?? null,
    vat: a?.vat ?? null,
    page: line.page,
    source: line.text.trim(),
    consistent: a?.consistent ?? false,
    splitNote,
  };
}

function extractLines(lines: DocLine[], warnings: string[]): { items: ParsedLine[]; tableStart: number; tableEnd: number; headerFound: boolean } {
  const items: ParsedLine[] = [];
  let tableStart = -1;
  let tableEnd = -1;
  let headerFound = false;
  const mh = medianHeight(lines);
  for (let i = 0; i < lines.length; i++) {
    const roles = detectHeader(lines[i]);
    if (!roles) continue;
    headerFound = true;
    if (tableStart < 0) tableStart = i;
    const header: Header = { idx: i, line: lines[i], roles };
    const order = roles.filter(r => r.role !== 'desc' && r.role !== 'code').map(r => r.role as Role);
    let last: ParsedLine | null = null;
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (l.page !== lines[i].page) break; // otra página: puede repetir cabecera
      if (detectHeader(l)) break;
      const t = l.text.trim();
      const isTotals = TOTALS_RE.test(t) && !/^\S+\s+.*\b(total)\b/i.test(t.slice(0, 2));
      if (isTotals && (findNumbers(t).length <= 2 || /^(base|subtotal|total|suma|importe\s+total|cuota)/i.test(t))) break;
      const row = parseRow(l, order.length ? order : null, header);
      if (!row) continue;
      const hasNumbers = row.amount !== null || row.unitPrice !== null || row.quantity !== null;
      if (!hasNumbers) {
        // texto sin números → continuación de la descripción anterior
        if (last && l.y - lastY(items, lines, j) < mh * 2.4 && !/^(nota|observ|total|forma)/i.test(t)) {
          last.description = `${last.description} ${row.code ? row.code + ' ' : ''}${row.description}`.trim();
          last.source += `\n${t}`;
        }
        continue;
      }
      const qty = row.quantity;
      const pl: ParsedLine = {
        ...row,
        isShipping: SHIPPING_RE.test(row.description),
        check:
          row.consistent ? 'ok' : row.amount !== null && row.unitPrice !== null ? 'mismatch' : 'incomplete',
        note: row.consistent
          ? undefined
          : row.amount !== null && row.unitPrice !== null
            ? 'Cantidad × precio (− dto) no coincide con el importe: revisa los números.'
            : qty === null && row.unitPrice === null
              ? 'Solo se ha leído el importe.'
              : 'Falta algún valor de la línea.',
      };
      if (row.splitNote) {
        pl.note = row.splitNote;
        pl.check = 'mismatch';
      }
      delete (pl as unknown as Record<string, unknown>).consistent;
      delete (pl as unknown as Record<string, unknown>).splitNote;
      items.push(pl);
      last = pl;
      (pl as unknown as { _y: number })._y = l.y;
    }
    tableEnd = j;
    i = j - 1;
  }

  // Sin cabecera: buscar filas que "cuadren" (cantidad × precio = importe)
  if (!headerFound) {
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].text;
      if (TOTALS_RE.test(t)) continue;
      const row = parseRow(lines[i], null, null);
      if (row && row.consistent && row.quantity !== null && row.unitPrice !== null) {
        items.push({
          ...row,
          isShipping: SHIPPING_RE.test(row.description),
          check: 'ok',
          note: 'Detectada sin cabecera de tabla: revísala.',
        });
        delete (items[items.length - 1] as unknown as Record<string, unknown>).consistent;
        if (tableStart < 0) tableStart = i;
        tableEnd = i + 1;
      }
    }
    if (items.length) warnings.push('No se encontró la cabecera de la tabla de productos; las líneas se han detectado porque sus cuentas cuadran.');
  }

  // duplicados
  items.forEach((it, idx) => {
    const key = `${it.code ?? ''}|${norm(it.description)}|${it.quantity}|${it.unitPrice}|${it.amount}`;
    const prev = items.findIndex((o, k) => k < idx && `${o.code ?? ''}|${norm(o.description)}|${o.quantity}|${o.unitPrice}|${o.amount}` === key);
    if (prev >= 0) {
      it.duplicateOf = prev;
      warnings.push(`La línea "${it.description.slice(0, 40)}" aparece repetida (líneas ${prev + 1} y ${idx + 1}). Comprueba si es correcto.`);
    }
  });
  items.forEach(it => delete (it as unknown as Record<string, unknown>)._y);
  return { items, tableStart, tableEnd, headerFound };
}

function lastY(items: ParsedLine[], lines: DocLine[], j: number): number {
  const it = items[items.length - 1] as unknown as { _y?: number };
  return it?._y ?? lines[j - 1]?.y ?? 0;
}

// ---------------------------------------------------------------- totales

function extractTotals(lines: DocLine[], from: number, doc: ParsedDoc) {
  const start = Math.max(0, from);
  const take = (l: DocLine, label: RegExp): { v: number; rate?: number } | null => {
    const m = label.exec(l.text);
    if (!m) return null;
    const after = l.text.slice(m.index + m[0].length);
    const nums = findNumbers(after);
    const rateTok = nums.find(n => n.percent) ?? (/\b(iva|vat)\b/i.test(m[0]) ? nums.find(n => [4, 5, 10, 21].includes(n.value) && nums.length > 1) : undefined);
    const amounts = nums.filter(n => n !== rateTok && !n.percent);
    if (!amounts.length) return null;
    return { v: amounts[amounts.length - 1].value, rate: rateTok?.value };
  };

  // Tabla de totales: fila de etiquetas y debajo fila de importes
  for (let i = start; i < lines.length - 1; i++) {
    const l = lines[i];
    const labels = l.cells.filter(c => /base\s+imp|subtotal|%\s?iva|iva\s?%|cuota|^iva$|^total/i.test(norm(c.text)));
    if (labels.length >= 2 && !findNumbers(l.text).filter(n => !n.percent).length) {
      const below = lines[i + 1];
      for (const c of labels) {
        const bc = below.cells.find(x => overlap(x, c));
        const n = bc ? findNumbers(bc.text)[0] : undefined;
        if (!n) continue;
        const k = norm(c.text);
        if (/base|subtotal/.test(k) && !doc.totals.base) doc.totals.base = f(n.value, below);
        else if (/%\s?iva|iva\s?%|tipo/.test(k)) doc.totals.vatRate = f(n.value, below);
        else if (/cuota|^iva/.test(k) && !doc.totals.vatAmount) doc.totals.vatAmount = f(n.value, below);
        else if (/^total/.test(k)) doc.totals.total = f(n.value, below);
      }
    }
  }

  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    const t = l.text;
    let r;
    if ((r = take(l, /\b(base\s+imponible|subtotal|sub-total|total\s+(?:neto|bruto|sin\s+iva|base|l[ií]neas|art[ií]culos|productos)|importe\s+neto|neto|suma\s+total|tax\s+base|net\s+amount|total\s+excl\.?\s*(?:vat|iva))\b/i))) {
      if (!doc.totals.base) doc.totals.base = f(r.v, l);
      continue;
    }
    if ((r = take(l, /\b(cuota\s+(?:de\s+)?i\.?v\.?a\.?|i\.?v\.?a\.?|vat|impuestos?)\b/i)) && !/recargo|incluido|incl\./i.test(t)) {
      if (!doc.totals.vatAmount) doc.totals.vatAmount = f(r.v, l);
      if (r.rate !== undefined && !doc.totals.vatRate) doc.totals.vatRate = f(r.rate, l);
      continue;
    }
    if ((r = take(l, /\b(total\s+(?:factura|pedido|oferta|presupuesto|documento|a\s+pagar|eur|€|con\s+iva|general|importe)|importe\s+total|total|grand\s+total|amount\s+due)\b/i))) {
      doc.totals.total = f(r.v, l); // el último "total" del documento suele ser el final
      continue;
    }
    if (/recargo\s+(?:de\s+)?equivalencia/i.test(t)) doc.warnings.push('El documento tiene recargo de equivalencia; la app no lo calcula, revísalo a mano.');
    if (/retenci[oó]n|i\.?r\.?p\.?f/i.test(t) && findNumbers(t).length) doc.warnings.push('El documento tiene retención (IRPF); la app no la calcula.');
    if (/\b(dto\.?|descuento)\s+(?:pronto\s+pago|comercial|global|general|p\.?\s?p\.?)/i.test(t) && findNumbers(t).length)
      doc.warnings.push(`Hay un descuento general al pie ("${t.trim().slice(0, 60)}"); no se reparte entre las líneas.`);
  }
  // tipo de IVA en cualquier parte si no se encontró
  if (!doc.totals.vatRate) {
    for (const l of lines) {
      const m = /\b(?:i\.?v\.?a\.?|vat)\s*(?:al\s*)?\(?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i.exec(l.text) ?? /\b(\d{1,2})\s*%\s*(?:de\s+)?i\.?v\.?a\b/i.exec(l.text);
      if (m) {
        doc.totals.vatRate = f(Number(m[1].replace(',', '.')), l);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- principal

export function parseDocument(lines: DocLine[], ctx: ParseContext = {}): ParsedDoc {
  const warnings: string[] = [];
  const doc: ParsedDoc = {
    docType: 'otro',
    issuer: emptyParty(),
    recipient: emptyParty(),
    customerIs: 'recipient',
    customerConfident: false,
    customerReason: '',
    refs: {},
    lines: [],
    totals: {},
    linesSum: 0,
    currency: 'EUR',
    warnings,
    otherAddresses: [],
  };
  if (!lines.length) {
    warnings.push('No se ha podido leer texto en el documento.');
    return doc;
  }
  const mh = medianHeight(lines);
  const page1 = lines.filter(l => l.page === 1);
  const pageWidth = Math.max(...page1.map(l => (l.cells.length ? l.cells[l.cells.length - 1].x1 : 0)), 600);

  // Tipo de documento: primer título reconocible en la parte alta
  outer: for (const l of page1.slice(0, 25)) {
    for (const d of DOC_TITLES) {
      if (d.re.test(l.text) && !/^(forma|condiciones|su\s|nuestro|vuestro|s\/)/i.test(l.text.trim())) {
        // "Nº pedido" dentro de una factura no cambia el tipo si la línea es solo una etiqueta con valor
        if (d.type === 'pedido' && /\b(su|n[ºo°]|vuestro|cliente|s\/)\s*pedido/i.test(l.text)) continue;
        doc.docType = d.type;
        doc.docTypeSource = l.text.trim();
        break outer;
      }
    }
  }

  // Moneda
  const all = lines.map(l => l.text).join('\n');
  if (/\bUSD\b|US\$|\$\s?\d/.test(all) && !/€|EUR/.test(all)) doc.currency = 'USD';
  else if (/\bGBP\b|£/.test(all) && !/€|EUR/.test(all)) doc.currency = 'GBP';
  if (doc.currency !== 'EUR') warnings.push(`Los importes están en ${doc.currency}, no en euros. La app guarda euros: convierte antes de guardar.`);

  // Líneas de producto
  const table = extractLines(lines, warnings);
  doc.lines = table.items;

  // Referencias y condiciones
  const refPatterns: { key: keyof ParsedDoc['refs']; re: RegExp }[] = [
    { key: 'numero_pedido_cliente', re: /\b(su\s+(?:n[ºo°.]?\s*(?:de\s+)?)?pedido|vuestro\s+pedido|s\/\s?pedido|s\/\s?ref\.?|su\s+ref(?:erencia)?\.?|ref(?:erencia)?\.?\s+(?:del\s+)?cliente|pedido\s+(?:del\s+)?cliente|n[ºo°.]?\s*(?:de\s+)?pedido\s+cliente|p\.?\s?o\.?\s+(?:n[ºo°]|number|#)|purchase\s+order|your\s+(?:order|ref(?:erence)?))\b\.?/i },
    { key: 'oferta_proforma', re: /\b((?:n[ºo°.]?\s*(?:de\s+)?)?(?:oferta|presupuesto|proforma|pro-forma|cotizaci[oó]n|quotation|quote))\b\.?/i },
    { key: 'numero_albaran', re: /\b((?:n[ºo°.]?\s*(?:de\s+)?)?(?:albar[aá]n|nota\s+de\s+entrega|recibo|delivery\s+note))\b\.?/i },
    { key: 'numero_factura', re: /\b((?:n[ºo°.]?\s*(?:de\s+)?)?factura|invoice(?:\s+(?:no|number|#))?|fra\.)\b\.?/i },
    { key: 'numero_documento', re: /\b(n[ºo°]\s*(?:de\s+)?(?:documento|pedido)|n[uú]mero(?:\s+de\s+(?:documento|pedido))?|pedido\s+n[ºo°.]?|order\s+(?:no|number|#)|documento|doc\.?\s*n[ºo°])\b\.?/i },
  ];
  const tableTop = table.tableStart >= 0 ? table.tableStart : lines.length;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (i >= tableTop && i < table.tableEnd) continue;
    for (const p of refPatterns) {
      if (doc.refs[p.key]) continue;
      if (p.key === 'numero_factura' && /pro-?\s?forma/i.test(l.text)) continue;
      const v = valueAfterLabel(lines, i, p.re);
      if (v && v.value.length >= 2 && !/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(v.value)) {
        doc.refs[p.key] = f(v.value, v.line);
      }
    }
    if (!doc.refs.fecha && /\b(fecha|date|data)\b/i.test(l.text)) {
      const d = findDates(l.text)[0] ?? (lines[i + 1] ? findDates(lines[i + 1].text)[0] : undefined);
      if (d) doc.refs.fecha = f(d.iso, l);
    }
    if (!doc.condiciones_pago) {
      const m = /\b(forma\s+de\s+pago|condiciones\s+de\s+pago|modo\s+de\s+pago|pago|payment\s+terms|vencimiento)\s*[:.]\s*(.+)$/i.exec(l.text);
      if (m && /[a-z]{3}/i.test(m[2])) doc.condiciones_pago = f(m[2].trim().replace(/\s{2,}.*$/, '').replace(/\.\s+[A-ZÁÉÍÓÚ][\p{L}\s]{2,30}:.*$/u, ''), l);
    }
    if (!doc.condiciones_entrega) {
      const m = /\b(plazo\s+de\s+entrega|condiciones\s+de\s+entrega|fecha\s+de\s+entrega|entrega|incoterms?|portes)\s*[:.]\s*(.+)$/i.exec(l.text);
      if (m && /\w{2}/.test(m[2])) doc.condiciones_entrega = f(`${/portes/i.test(m[1]) ? 'Portes ' : ''}${m[2].trim().replace(/\s{3,}.*$/, '')}`, l);
    }
  }
  if (!doc.refs.fecha) {
    const d = page1.slice(0, 30).map(l => ({ l, d: findDates(l.text)[0] })).find(x => x.d);
    if (d) doc.refs.fecha = f(d.d!.iso, d.l, 'doubtful', 'Primera fecha del documento (sin etiqueta "Fecha").');
  }
  // En un pedido de compra el propio número del documento es el nº de pedido del cliente
  if (!doc.refs.numero_pedido_cliente && doc.docType === 'pedido' && doc.refs.numero_documento) {
    doc.refs.numero_pedido_cliente = { ...doc.refs.numero_documento, status: 'doubtful', note: 'Es el número del propio pedido.' };
  }

  // ---------------- Partes
  const headerLines = page1.filter((_, i) => i < (table.tableStart >= 0 && lines[table.tableStart].page === 1 ? lines.indexOf(lines[table.tableStart]) : page1.length));
  const anchorIdx = headerLines.findIndex(l => l.cells.some(c => CLIENT_ANCHOR.test(c.text.trim()) || SUPPLIER_ANCHOR.test(c.text.trim())) || CLIENT_ANCHOR.test(l.text.trim()));
  let recipientCells: { text: string; line: DocLine }[] = [];
  let recipientRegion: { x0: number; x1: number } | null = null;
  let anchorKind: 'client' | 'supplier' | null = null;

  const blockFrom = (startIdx: number, region: { x0: number; x1: number } | null, firstRemainder: string | null) => {
    const out: { text: string; line: DocLine }[] = [];
    if (firstRemainder && firstRemainder.trim()) out.push({ text: firstRemainder.trim(), line: headerLines[startIdx] });
    let prevY = headerLines[startIdx].y;
    for (let k = startIdx + 1; k < headerLines.length && out.length < 10; k++) {
      const l = headerLines[k];
      if (l.y - prevY > mh * 2.6) break;
      const cells = region ? l.cells.filter(c => c.x0 >= region.x0 - 6 && c.x0 < region.x1) : l.cells;
      const txt = cells.map(c => c.text).join(' ').trim();
      if (!txt) {
        if (region) continue;
        break;
      }
      if (cells.some(c => (CLIENT_ANCHOR.test(c.text.trim()) || SHIPTO_ANCHOR.test(c.text.trim()) || SUPPLIER_ANCHOR.test(c.text.trim())) && k !== startIdx)) break;
      if (detectHeader(l)) break;
      out.push({ text: txt, line: l });
      prevY = l.y;
    }
    return out;
  };

  if (anchorIdx >= 0) {
    const l = headerLines[anchorIdx];
    const cell = l.cells.find(c => CLIENT_ANCHOR.test(c.text.trim()) || SUPPLIER_ANCHOR.test(c.text.trim())) ?? l.cells[0];
    anchorKind = SUPPLIER_ANCHOR.test(cell.text.trim()) ? 'supplier' : 'client';
    const m = (anchorKind === 'client' ? CLIENT_ANCHOR : SUPPLIER_ANCHOR).exec(cell.text.trim())!;
    const remainder = cell.text.trim().slice(m[0].length);
    const others = l.cells.filter(c => c !== cell);
    const rightNeighbour = others.filter(c => c.x0 > cell.x1 + pageWidth * 0.12).sort((a, b) => a.x0 - b.x0)[0];
    const leftNeighbour = others.filter(c => c.x1 < cell.x0 - pageWidth * 0.08).sort((a, b) => b.x1 - a.x1)[0];
    recipientRegion = {
      x0: leftNeighbour ? Math.max(leftNeighbour.x1 + 1, cell.x0 - 8) : cell.x0 > pageWidth * 0.35 ? cell.x0 - 8 : 0,
      x1: rightNeighbour ? rightNeighbour.x0 : pageWidth + 1,
    };
    // si el resto de la etiqueta está vacío y la celda de la derecha está pegada, es el valor
    let firstRem = remainder;
    if (!firstRem.trim()) {
      const adj = others.find(c => c.x0 > cell.x1 && c.x0 - cell.x1 < pageWidth * 0.12);
      if (adj) {
        firstRem = adj.text;
        recipientRegion.x0 = Math.min(recipientRegion.x0, cell.x0 - 8);
      }
    }
    recipientCells = blockFrom(anchorIdx, recipientRegion, firstRem);
    doc.recipient = parseParty(recipientCells, warnings, anchorKind === 'client' ? 'Cliente' : 'Proveedor');
    doc.recipient.label = m[1].replace(/\s+/g, ' ');
  } else {
    // Sin etiqueta: ¿dos columnas en la cabecera?
    const rightCells = headerLines.flatMap(l => l.cells.filter(c => c.x0 > pageWidth * 0.45).map(c => ({ text: c.text, line: l })));
    const rightHasParty = rightCells.some(c => /\b\d{5}\b/.test(c.text) || findTaxIds(c.text).length || LEGAL_FORM_RE.test(c.text.trim()));
    if (rightHasParty && rightCells.length >= 2) {
      // tomar el grupo de la derecha que contiene el CP/NIF (bloque contiguo)
      const groups: { text: string; line: DocLine }[][] = [];
      for (const c of rightCells) {
        const g = groups[groups.length - 1];
        if (g && c.line.y - g[g.length - 1].line.y < mh * 2.4) g.push(c);
        else groups.push([c]);
      }
      const g = groups.find(gr => gr.some(c => /\b\d{5}\b/.test(c.text) || findTaxIds(c.text).length)) ?? groups[0];
      recipientCells = g.filter(c => !REF_LABEL_LINE.test(c.text.trim()) || findTaxIds(c.text).length);
      recipientRegion = { x0: pageWidth * 0.45, x1: pageWidth + 1 };
      doc.recipient = parseParty(recipientCells, warnings, 'Destinatario');
      doc.recipient.label = 'Bloque a la derecha (sin etiqueta)';
    }
  }

  // Emisor: cabecera fuera del bloque destinatario + pie legal
  const recLines = new Set(recipientCells.map(c => c.line));
  const issuerBlock: { text: string; line: DocLine }[] = [];
  for (const l of headerLines) {
    const cells = recipientRegion && recLines.has(l) ? l.cells.filter(c => !(c.x0 >= recipientRegion!.x0 - 6 && c.x0 < recipientRegion!.x1)) : l.cells;
    for (const c of cells) {
      const t = c.text.trim();
      if (!t || DOC_TITLES.some(d => new RegExp(`^${d.re.source}\\s*[:.]?\\s*$`, 'i').test(t))) continue;
      if (CLIENT_ANCHOR.test(t) || SHIPTO_ANCHOR.test(t)) continue;
      issuerBlock.push({ text: t, line: l });
    }
  }
  // Si no hubo etiqueta ni columnas: dividir por huecos verticales
  if (!recipientCells.length) {
    const groups: { text: string; line: DocLine }[][] = [];
    for (const b of issuerBlock) {
      const g = groups[groups.length - 1];
      if (g && b.line.y - g[g.length - 1].line.y < mh * 2.4) g.push(b);
      else groups.push([b]);
    }
    if (groups.length > 1) {
      const recG = groups.slice(1).find(gr => gr.some(c => /\b\d{5}\b/.test(c.text) || findTaxIds(c.text).length));
      if (recG) {
        doc.recipient = parseParty(recG, warnings, 'Destinatario');
        doc.recipient.label = 'Segundo bloque (sin etiqueta)';
        recipientCells = recG;
        const recSet = new Set(recG);
        issuerBlock.splice(0, issuerBlock.length, ...issuerBlock.filter(b => !recSet.has(b)));
      }
    }
  }
  // Pie con datos registrales (suele ser del emisor)
  const lastPage = Math.max(...lines.map(l => l.page));
  const footer = lines.filter(
    l => (l.page === 1 || l.page === lastPage) && /registro\s+mercantil|inscrita|tomo|folio|hoja\s+[a-z]{1,2}-?\d|c\.?i\.?f\.?|n\.?i\.?f\.?/i.test(l.text) && !recLines.has(l) && lines.indexOf(l) > (table.tableEnd > 0 ? table.tableEnd - 1 : 0),
  );
  const issuerParty = parseParty(issuerBlock.filter(b => !/^(p[aá]gina|page)\b/i.test(b.text)).slice(0, 14), warnings, 'Emisor');
  if (!issuerParty.fields.nif) {
    for (const l of footer) {
      const ids = findTaxIds(l.text).filter(id => id.clean !== doc.recipient.fields.nif?.value);
      if (ids.length) {
        issuerParty.fields.nif = f(ids[0].clean, l, ids[0].valid === false ? 'doubtful' : 'ok', 'Tomado del pie del documento.');
        break;
      }
    }
  }
  if (footer.length) issuerParty.block.push(...footer.map(l => l.text.trim()));
  doc.issuer = issuerParty;

  // Dirección de entrega distinta
  const shipIdx = headerLines.findIndex(l => l.cells.some(c => SHIPTO_ANCHOR.test(c.text.trim())));
  if (shipIdx >= 0) {
    const cell = headerLines[shipIdx].cells.find(c => SHIPTO_ANCHOR.test(c.text.trim()))!;
    const region = { x0: cell.x0 - 8, x1: cell.x0 + pageWidth * 0.45 };
    const b = blockFrom(shipIdx, region, cell.text.replace(SHIPTO_ANCHOR, ''));
    if (b.length) doc.otherAddresses.push(b.map(x => x.text).join(', '));
    if (!doc.recipient.block.length) {
      doc.recipient = parseParty(b, warnings, 'Entrega');
      doc.recipient.label = 'Dirección de entrega';
    }
  }

  // ---------------- ¿Quién es el cliente?
  const nm = (p: Party) => norm(p.fields.nombre_empresa?.value ?? p.block.join(' '));
  const matches = (p: Party, name: string) => {
    const a = nm(p);
    const b = norm(name).replace(/\b(s\.?l\.?u?|s\.?a\.?u?)\.?$/i, '').trim();
    return !!b && b.length >= 3 && (a.includes(b) || p.block.some(t => norm(t).includes(b)));
  };
  const known = ctx.knownCustomers ?? [];
  const isKnown = (p: Party) =>
    known.some(k => (k.nif && p.fields.nif && k.nif.toUpperCase().replace(/[^A-Z0-9]/g, '') === p.fields.nif.value) || (k.name && matches(p, k.name)));
  const own = ctx.ownNames ?? ['AO Gestiones'];
  const isOwn = (p: Party) => own.some(n => matches(p, n));
  for (const m of ctx.manufacturers ?? []) {
    if (matches(doc.issuer, m.name)) doc.manufacturerMatch = { id: m.id, name: m.name, party: 'issuer' };
    else if (matches(doc.recipient, m.name)) doc.manufacturerMatch = { id: m.id, name: m.name, party: 'recipient' };
    if (doc.manufacturerMatch) break;
  }
  const hasRecipient = !!doc.recipient.block.length;
  if (hasRecipient && isKnown(doc.recipient) && !isKnown(doc.issuer)) {
    doc.customerIs = 'recipient';
    doc.customerConfident = true;
    doc.customerReason = 'El destinatario coincide con un cliente de pedidos anteriores.';
  } else if (isKnown(doc.issuer) && !isKnown(doc.recipient)) {
    doc.customerIs = 'issuer';
    doc.customerConfident = true;
    doc.customerReason = 'El emisor coincide con un cliente de pedidos anteriores.';
  } else if (doc.manufacturerMatch || isOwn(doc.issuer) || isOwn(doc.recipient)) {
    const issuerIsOther = doc.manufacturerMatch?.party === 'issuer' || isOwn(doc.issuer);
    doc.customerIs = issuerIsOther ? 'recipient' : 'issuer';
    doc.customerConfident = true;
    doc.customerReason = doc.manufacturerMatch
      ? `${doc.manufacturerMatch.party === 'issuer' ? 'El emisor' : 'El destinatario'} es el fabricante ${doc.manufacturerMatch.name}.`
      : 'Uno de los dos es AO Gestiones.';
  } else if (anchorKind === 'supplier') {
    doc.customerIs = 'issuer';
    doc.customerConfident = true;
    doc.customerReason = `El bloque etiquetado "${doc.recipient.label}" es el proveedor, así que el cliente es quien emite el pedido.`;
  } else if (anchorKind === 'client') {
    doc.customerIs = 'recipient';
    doc.customerConfident = true;
    doc.customerReason = `Bloque etiquetado "${doc.recipient.label}" en el documento.`;
  } else if (doc.docType === 'pedido') {
    doc.customerIs = 'issuer';
    doc.customerReason = 'Es un pedido de compra: normalmente lo emite el cliente. Confírmalo.';
  } else {
    doc.customerIs = hasRecipient ? 'recipient' : 'issuer';
    doc.customerReason = hasRecipient ? 'Bloque destinatario sin etiqueta. Confírmalo.' : 'Solo se ha encontrado un bloque de datos. Confirma si es el cliente.';
  }
  if (!hasRecipient) warnings.push('No se ha encontrado un bloque de cliente/destinatario claro.');
  if (doc.issuer.fields.nif && doc.recipient.fields.nif && doc.issuer.fields.nif.value === doc.recipient.fields.nif.value) {
    warnings.push('El emisor y el destinatario tienen el mismo NIF: revisa la separación de los datos.');
  }

  // ---------------- Totales y comprobaciones
  extractTotals(lines, table.tableEnd > 0 ? table.tableEnd : Math.floor(lines.length / 2), doc);
  if (doc.totals.total && doc.totals.base && doc.totals.total.value < doc.totals.base.value) {
    // probablemente el "total" leído no es el final
    doc.totals.total.status = 'doubtful';
  }
  const sum = round2(doc.lines.reduce((s, l) => s + (l.amount ?? (l.unitPrice !== null ? (l.quantity ?? 1) * l.unitPrice * (1 - (l.discount ?? 0) / 100) : 0)), 0));
  doc.linesSum = sum;
  const base = doc.totals.base?.value;
  if (base !== undefined && doc.lines.length) {
    if (!close(sum, base, 0.002)) {
      warnings.push(`La suma de las líneas (${fmt(sum)}) no coincide con la base imponible del documento (${fmt(base)}). Diferencia: ${fmt(round2(base - sum))}.`);
    }
  }
  const { vatAmount, vatRate, total } = doc.totals;
  if (base !== undefined && vatAmount && total && !close(base + vatAmount.value, total.value, 0.002)) {
    warnings.push(`Base + IVA (${fmt(round2(base + vatAmount.value))}) no coincide con el total (${fmt(total.value)}).`);
  }
  if (base !== undefined && vatAmount && vatRate && !close((base * vatRate.value) / 100, vatAmount.value, 0.01)) {
    warnings.push(`El IVA del ${vatRate.value} % sobre ${fmt(base)} no da ${fmt(vatAmount.value)}: puede haber varios tipos de IVA.`);
  }
  if (!vatRate && base !== undefined && vatAmount && base > 0) {
    const r = round2((vatAmount.value / base) * 100);
    if ([4, 10, 21].some(x => Math.abs(x - r) < 0.15)) {
      doc.totals.vatRate = { value: Math.round(r), status: 'derived', note: `Calculado: ${fmt(vatAmount.value)} / ${fmt(base)}.`, source: vatAmount.source, page: vatAmount.page };
    }
  }
  if (!doc.lines.length) warnings.push('No se han encontrado líneas de productos. Puedes añadirlas a mano.');
  const bad = doc.lines.filter(l => l.check === 'mismatch').length;
  if (bad) warnings.push(`${bad} línea(s) con cuentas que no cuadran: están marcadas para revisar.`);
  return doc;
}

const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
