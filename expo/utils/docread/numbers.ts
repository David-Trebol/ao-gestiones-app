/** Números y fechas en formato español/europeo. */

export interface NumToken {
  value: number;
  /** Otra lectura posible (p. ej. "1.500" → 1500 o 1,5) */
  alt?: number;
  raw: string;
  start: number;
  end: number;
  percent: boolean;
  currency: boolean;
}

/** Convierte "1.234,56", "1,234.56", "12,5", "1234" → número. null si no es un número. */
export function parseNumber(raw: string): { value: number; alt?: number } | null {
  let s = raw
    .replace(/[  ]/g, ' ')
    .replace(/(EUR|€|\$|£|%)/gi, '')
    .trim();
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (/^[-−–]/.test(s)) {
    neg = true;
    s = s.slice(1);
  }
  if (/[-−–]$/.test(s)) {
    neg = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/\s+/g, '');
  if (!/^\d[\d.,']*$/.test(s) || /[.,']$/.test(s)) return null;
  s = s.replace(/'/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let value: number;
  let alt: number | undefined;
  if (lastComma >= 0 && lastDot >= 0) {
    value = lastComma > lastDot ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s.replace(/,/g, ''));
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    value = parts.length > 2 ? Number(parts.join('')) : Number(s.replace(',', '.'));
  } else if (lastDot >= 0) {
    const parts = s.split('.');
    if (parts.length > 2) value = Number(parts.join(''));
    else if (parts[1].length === 3) {
      // En España "1.500" son mil quinientos; se guarda la otra lectura por si acaso
      value = Number(parts.join(''));
      alt = Number(s);
    } else value = Number(s);
  } else value = Number(s);
  if (!Number.isFinite(value)) return null;
  if (neg) {
    value = -value;
    if (alt !== undefined) alt = -alt;
  }
  return { value, alt };
}

// Número que no forma parte de un código ("M8", "REF-120", fechas "12/03/2026", horas "10:30")
const NUM_RE = /(?<![\p{L}\d\/:._#-])([-−]?\d+(?:[.,']\d+)*)(\s?%)?(\s?(?:€|EUR))?(?![\p{L}\d\/:]|[.,]\d)/gu;

export function findNumbers(text: string): NumToken[] {
  const out: NumToken[] = [];
  let m: RegExpExecArray | null;
  NUM_RE.lastIndex = 0;
  while ((m = NUM_RE.exec(text))) {
    const p = parseNumber(m[1]);
    if (!p) continue;
    out.push({
      value: p.value,
      alt: p.alt,
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      percent: !!m[2],
      currency: !!m[3],
    });
  }
  return out;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** ¿Coinciden dos importes? (tolerancia de redondeo) */
export function close(a: number, b: number, rel = 0.006): boolean {
  return Math.abs(a - b) <= Math.max(0.021, Math.abs(b) * rel);
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Encuentra fechas (dd/mm/aaaa, dd-mm-aa, "3 de marzo de 2026") → AAAA-MM-DD */
export function findDates(text: string): { iso: string; raw: string; index: number }[] {
  const out: { iso: string; raw: string; index: number }[] = [];
  const re1 = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text))) {
    const d = +m[1], mo = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) {
      out.push({ iso: `${y}-${pad(mo)}-${pad(d)}`, raw: m[0], index: m.index });
    }
  }
  const re2 = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = re2.exec(text))) out.push({ iso: m[0], raw: m[0], index: m.index });
  const re3 = /\b(\d{1,2})\s+(?:de\s+)?([a-záéíóú]{3,10})\.?\s+(?:de\s+)?(\d{4})\b/gi;
  while ((m = re3.exec(text))) {
    const mo = MONTHS[m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')];
    if (mo) out.push({ iso: `${m[3]}-${pad(mo)}-${pad(+m[1])}`, raw: m[0], index: m.index });
  }
  return out.sort((a, b) => a.index - b.index);
}
