import { RawItem } from './layout';


/**
 * Saca los trozos de texto de una página de PDF.js con su posición en pantalla.
 * El texto vertical (márgenes con datos registrales) se devuelve aparte.
 */
export async function pdfPageItems(page: any, pdfjsLib: any): Promise<{ items: RawItem[]; vertical: string[]; width: number; height: number }> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent({ normalizeWhitespace: true });
  const items: RawItem[] = [];
  const vertical: string[] = [];
  for (const it of content.items as any[]) {
    if (!('str' in it) || !it.str || !it.str.trim()) continue;
    const tx = pdfjsLib.Util.transform(viewport.transform, it.transform);
    const fontH = Math.hypot(tx[2], tx[3]);
    const isVertical = Math.abs(tx[1]) > Math.abs(tx[0]) * 2;
    if (isVertical) {
      vertical.push(it.str);
      continue;
    }
    const w = it.width ? it.width * viewport.scale : it.str.length * fontH * 0.5;
    items.push({ str: it.str, x: tx[4], y: tx[5] - fontH, w, h: fontH });
  }
  return { items, vertical, width: viewport.width, height: viewport.height };
}
