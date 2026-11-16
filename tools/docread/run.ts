import { buildLines, RawItem, deskew, ocrScore, normalizeOcrHeights, shouldTryRotations } from '../../expo/utils/docread/layout';
import { pdfPageItems } from '../../expo/utils/docread/pdftext';
import { parseDocument } from '../../expo/utils/docread/parse';
import type { DocLine } from '../../expo/utils/docread/types';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
// eslint-disable-next-line
const pdfjsLib = require(process.env.PDFJS_LEGACY || 'pdfjs-dist/legacy/build/pdf.js');

async function pdfLines(path: string): Promise<DocLine[]> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(readFileSync(path)), isEvalSupported: false, disableWorker: true }).promise;
  const out: DocLine[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { items, vertical, height } = await pdfPageItems(page, pdfjsLib);
    const lines = buildLines(items, p);
    if (lines.map(l => l.text).join('').length < 25) {
      return ocrLines(path, true);
    }
    out.push(...lines);
    vertical.forEach((v, i) => out.push({ page: p, y: height + i * 10, h: 8, text: v, cells: [{ text: v, x0: 0, x1: 100 }] }));
  }
  return out;
}

function tess(img: string): RawItem[] {
  const tsv = execFileSync('tesseract', [img, '-', '--tessdata-dir', process.env.TESSDATA || '/tmp/tessdata', '-l', 'spa', '--psm', '3', '-c', 'preserve_interword_spaces=1', '-c', 'tessedit_create_tsv=1'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const items: RawItem[] = [];
  for (const row of tsv.split('\n').slice(1)) {
    const c = row.split('\t');
    if (c.length < 12 || c[0] !== '5' || !c[11]?.trim()) continue;
    items.push({ str: c[11], x: +c[6], y: +c[7], w: +c[8], h: +c[9], conf: +c[10], lineKey: `${c[2]}-${c[3]}-${c[4]}` });
  }
  return items;
}
function ocrLines(path: string, isPdf = false): DocLine[] {
  let img = path;
  if (isPdf) {
    execFileSync('pdftoppm', ['-r', '200', '-png', '-f', '1', '-l', '1', path, '/tmp/ocrpage']);
    img = '/tmp/ocrpage-1.png';
  }
  let items = tess(img);
  let best = { items, score: ocrScore(items), rot: 0 };
  const meanConf = items.reduce((s, i) => s + (i.conf ?? 0), 0) / Math.max(1, items.length);
  if (shouldTryRotations(items)) {
    for (const rot of [90, 270, 180]) {
      execFileSync('convert', [img, '-rotate', String(rot), '/tmp/rot.png']);
      const it = tess('/tmp/rot.png');
      const sc = ocrScore(it);
      if (sc > best.score * 1.3) best = { items: it, score: sc, rot };
    }
  }
  if (best.rot) console.error('rotación elegida', best.rot);
  const ds = deskew(normalizeOcrHeights(best.items));
  console.error('inclinación', ds.angleDeg.toFixed(2));
  return buildLines(ds.items, 1, 1.1);
}

(async () => {
  const path = process.argv[2];
  const lines = /\.pdf$/i.test(path) ? await pdfLines(path) : ocrLines(path);
  if (process.argv.includes('--lines')) lines.forEach(l => console.log(`[${l.page}|${Math.round(l.y)}] ${l.cells.map(c => `${c.text}@${Math.round(c.x0)}`).join(' | ')}`));
  const doc = parseDocument(lines, { manufacturers: [{ id: 'm1', name: 'Suministros Industriales Levante' }], knownCustomers: [] });
  console.log(JSON.stringify(doc, (k, v) => (k === 'block' || k === 'source' ? undefined : v), 1));
})();
