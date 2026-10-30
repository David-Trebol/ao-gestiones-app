import { Cell, DocLine } from './types';

/** Un trozo de texto con su caja (de PDF.js o de una palabra del OCR). */
export interface RawItem {
  str: string;
  x: number;
  y: number; // borde superior
  w: number;
  h: number;
  conf?: number;
  /** Línea a la que lo asignó el OCR (para corregir la inclinación) */
  lineKey?: string;
}

/**
 * Corrige una inclinación pequeña (foto o escaneo torcido): calcula la pendiente
 * media de las líneas del OCR y endereza las coordenadas.
 */
export function deskew(items: RawItem[]): { items: RawItem[]; angleDeg: number } {
  const groups = new Map<string, RawItem[]>();
  for (const it of items) {
    if (!it.lineKey) continue;
    const g = groups.get(it.lineKey) ?? [];
    g.push(it);
    groups.set(it.lineKey, g);
  }
  const slopes: number[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const xs = g.map(i => i.x + i.w / 2);
    const ys = g.map(i => i.y + i.h);
    const span = Math.max(...xs) - Math.min(...xs);
    if (span < 150) continue;
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    xs.forEach((x, k) => {
      num += (x - mx) * (ys[k] - my);
      den += (x - mx) ** 2;
    });
    if (den > 0) slopes.push(num / den);
  }
  if (slopes.length < 3) return { items, angleDeg: 0 };
  slopes.sort((a, b) => a - b);
  const slope = slopes[Math.floor(slopes.length / 2)];
  if (Math.abs(slope) < 0.0015 || Math.abs(slope) > 0.2) return { items, angleDeg: 0 };
  return {
    items: items.map(i => ({ ...i, y: i.y - (i.x + i.w / 2) * slope })),
    angleDeg: (Math.atan(slope) * 180) / Math.PI,
  };
}

/** Puntuación de una lectura OCR (para elegir la orientación buena). */
export function ocrScore(items: RawItem[]): number {
  const good = items.filter(i => (i.conf ?? 0) > 60 && /\p{L}{3,}/u.test(i.str));
  const meanConf = items.length ? items.reduce((s, i) => s + (i.conf ?? 0), 0) / items.length : 0;
  const long = items.filter(i => i.str.length >= 4);
  const tallFrac = long.length ? long.filter(i => i.h > i.w).length / long.length : 0;
  // Si las palabras salen "de pie", el texto está girado aunque el OCR lo haya leído
  return good.length * (meanConf / 100) * (1 - tallFrac);
}

/** ¿Parece que la imagen está girada (o la lectura es mala) y conviene probar otras orientaciones? */
export function shouldTryRotations(items: RawItem[]): boolean {
  if (items.length < 25) return true;
  const long = items.filter(i => i.str.length >= 4);
  const tall = long.filter(i => i.h > i.w).length;
  const meanConf = items.reduce((s, i) => s + (i.conf ?? 0), 0) / items.length;
  return meanConf < 65 || (long.length > 0 && tall / long.length > 0.3);
}

/** Altura homogénea para palabras de OCR (las cajas varían con mayúsculas/minúsculas). */
export function normalizeOcrHeights(items: RawItem[]): RawItem[] {
  const hs = items.map(i => i.h).sort((a, b) => a - b);
  const mh = hs[Math.floor(hs.length / 2)] || 20;
  return items.map(i => ({ ...i, h: Math.max(i.h, mh * 0.8) }));
}

/**
 * Agrupa trozos de texto en líneas visuales y, dentro de cada línea, en celdas
 * separadas por huecos grandes (columnas). Mismo algoritmo para PDF y OCR.
 */
export function buildLines(items: RawItem[], page: number, gapFactor = 0.9): DocLine[] {
  const its = items
    .filter(i => i.str && i.str.trim() && i.h > 0)
    .map(i => ({ ...i, str: i.str.replace(/[  ]/g, ' ') }))
    .sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);
  const rows: { yc: number; h: number; items: RawItem[] }[] = [];
  for (const it of its) {
    const yc = it.y + it.h / 2;
    // fila más cercana compatible
    let row: (typeof rows)[number] | undefined;
    for (let k = rows.length - 1; k >= Math.max(0, rows.length - 4); k--) {
      const r = rows[k];
      if (Math.abs(r.yc - yc) < Math.min(r.h, it.h) * 0.55) {
        row = r;
        break;
      }
    }
    if (row) {
      row.items.push(it);
      row.yc = (row.yc * (row.items.length - 1) + yc) / row.items.length;
      row.h = Math.max(row.h, it.h);
    } else rows.push({ yc, h: it.h, items: [it] });
  }
  rows.sort((a, b) => a.yc - b.yc);
  return rows.map(r => {
    const sorted = r.items.sort((a, b) => a.x - b.x);
    const cells: Cell[] = [];
    let cur: { text: string; x0: number; x1: number } | null = null;
    for (const it of sorted) {
      const gap = cur ? it.x - cur.x1 : Infinity;
      if (cur && gap < r.h * gapFactor) {
        const needSpace = gap > r.h * 0.12 && !cur.text.endsWith(' ') && !it.str.startsWith(' ');
        cur.text += (needSpace ? ' ' : '') + it.str;
        cur.x1 = Math.max(cur.x1, it.x + it.w);
      } else {
        if (cur) cells.push(cur);
        cur = { text: it.str, x0: it.x, x1: it.x + it.w };
      }
    }
    if (cur) cells.push(cur);
    const clean = cells.map(c => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() })).filter(c => c.text);
    const confs = sorted.map(i => i.conf).filter((c): c is number => typeof c === 'number');
    return {
      page,
      y: r.yc - r.h / 2,
      h: r.h,
      cells: clean,
      text: clean.map(c => c.text).join('   '),
      conf: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : undefined,
    };
  }).filter(l => l.text);
}
