/**
 * Lectura de documentos 100 % en el navegador:
 *  - PDF con texto → PDF.js (texto exacto con posiciones)
 *  - Imágenes y PDF escaneados → OCR con Tesseract (WebAssembly)
 * Las librerías y el idioma se sirven desde la propia web (/vendor). El archivo no sale del dispositivo.
 */
import { buildLines, deskew, normalizeOcrHeights, ocrScore, RawItem, shouldTryRotations } from './layout';
import { pdfPageItems } from './pdftext';
import { parseDocument } from './parse';
import { DocLine, PageInfo, ParseContext, ParsedDoc, ReadResult } from './types';

export const DOC_READ_SUPPORTED = true;

export const LIMITS = {
  maxBytes: 25 * 1024 * 1024,
  maxPdfPages: 30,
  maxOcrPages: 8,
};

export class DocReadError extends Error {}

export type Progress = (p: { step: string; fraction?: number }) => void;

const VENDOR = '/vendor';
const scriptCache = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  if (!scriptCache.has(src)) {
    scriptCache.set(
      src,
      new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => {
          scriptCache.delete(src);
          reject(new DocReadError('No se pudo cargar el lector de documentos. Comprueba la conexión y vuelve a intentarlo.'));
        };
        document.head.appendChild(s);
      }),
    );
  }
  return scriptCache.get(src)!;
}

async function getPdfJs(): Promise<any> {
  await loadScript(`${VENDOR}/pdfjs/pdf.min.js`);
  const lib = (window as any).pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = `${VENDOR}/pdfjs/pdf.worker.min.js`;
  return lib;
}

let workerPromise: Promise<any> | null = null;
let progressSink: Progress | null = null;

async function getOcrWorker(onProgress: Progress): Promise<any> {
  progressSink = onProgress;
  if (!workerPromise) {
    workerPromise = (async () => {
      await loadScript(`${VENDOR}/tesseract/tesseract.min.js`);
      const T = (window as any).Tesseract;
      const origin = window.location.origin;
      const worker = await T.createWorker('spa', 1, {
        workerPath: `${origin}${VENDOR}/tesseract/worker.min.js`,
        corePath: `${origin}${VENDOR}/tesseract/core`,
        langPath: `${origin}${VENDOR}/tesseract/lang`,
        gzip: true,
        logger: (m: any) => {
          if (!progressSink) return;
          if (m.status === 'recognizing text') progressSink({ step: 'Reconociendo texto…', fraction: m.progress });
          else if (/loading|initializ/i.test(m.status)) progressSink({ step: 'Preparando el lector (solo la primera vez)…' });
        },
      });
      await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '3' });
      return worker;
    })().catch(e => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Libera el OCR (memoria) cuando ya no se necesita. */
export async function releaseReader() {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {
      // nada
    }
    workerPromise = null;
  }
}

function checkAbort(signal?: { aborted: boolean }) {
  if (signal?.aborted) throw new DocReadError('cancelled');
}

function canvasToPreview(canvas: HTMLCanvasElement, maxW = 1100): string {
  const scale = Math.min(1, maxW / canvas.width);
  if (scale === 1) return canvas.toDataURL('image/jpeg', 0.82);
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

function rotateCanvas(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const swap = deg % 180 !== 0;
  c.width = swap ? src.height : src.width;
  c.height = swap ? src.width : src.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

async function ocrCanvas(
  canvas: HTMLCanvasElement,
  page: number,
  onProgress: Progress,
  signal?: { aborted: boolean },
): Promise<{ lines: DocLine[]; info: PageInfo; preview: string }> {
  const worker = await getOcrWorker(onProgress);
  const run = async (c: HTMLCanvasElement) => {
    const { data } = await worker.recognize(c);
    const items: RawItem[] = [];
    const lines: any[] = data.lines ?? (data.blocks ?? []).flatMap((b: any) => (b.paragraphs ?? []).flatMap((p: any) => p.lines ?? []));
    lines.forEach((ln: any, li: number) => {
      for (const w of ln.words ?? []) {
        if (!w.text?.trim()) continue;
        items.push({
          str: w.text,
          x: w.bbox.x0,
          y: w.bbox.y0,
          w: w.bbox.x1 - w.bbox.x0,
          h: w.bbox.y1 - w.bbox.y0,
          conf: w.confidence,
          lineKey: String(li),
        });
      }
    });
    return items;
  };
  onProgress({ step: `Reconociendo texto (página ${page})…`, fraction: 0 });
  let best = { items: await run(canvas), rot: 0, canvas };
  let bestScore = ocrScore(best.items);
  if (shouldTryRotations(best.items)) {
    for (const rot of [90, 270, 180]) {
      checkAbort(signal);
      onProgress({ step: `La página ${page} parece girada: probando otra orientación…` });
      const rc = rotateCanvas(canvas, rot);
      const it = await run(rc);
      const sc = ocrScore(it);
      if (sc > bestScore * 1.3) {
        best = { items: it, rot, canvas: rc };
        bestScore = sc;
      }
    }
  }
  const ds = deskew(normalizeOcrHeights(best.items));
  const lines = buildLines(ds.items, page, 1.1);
  const confs = best.items.map(i => i.conf ?? 0);
  const meanConf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
  return {
    lines,
    info: { width: best.canvas.width, height: best.canvas.height, method: 'ocr', ocrConfidence: meanConf, rotation: best.rot },
    preview: canvasToPreview(best.canvas),
  };
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  let bmp: ImageBitmap | HTMLImageElement;
  try {
    bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as any);
  } catch {
    bmp = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(
          new DocReadError(
            /heic|heif/i.test(blob.type)
              ? 'Este navegador no puede abrir fotos HEIC. En el iPhone, compártela como JPG o haz una captura, y vuelve a intentarlo.'
              : 'No se pudo abrir la imagen. Prueba con un JPG, PNG o PDF.',
          ),
        );
      };
      img.src = url;
    });
  }
  const w = (bmp as any).width as number;
  const h = (bmp as any).height as number;
  // Tamaño útil para el OCR: se respeta el original salvo imágenes muy pequeñas o enormes
  const long = Math.max(w, h);
  const scale = long < 1000 ? Math.min(2.5, 1600 / long) : long > 3500 ? 3500 / long : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp as any, 0, 0, c.width, c.height);
  return c;
}

export interface ReadInput {
  uri: string;
  mimeType?: string;
  name?: string;
}

export async function readDocument(
  input: ReadInput,
  ctx: ParseContext,
  onProgress: Progress,
  signal?: { aborted: boolean },
): Promise<{ read: ReadResult; parsed: ParsedDoc }> {
  onProgress({ step: 'Abriendo el archivo…' });
  let blob: Blob;
  try {
    blob = await (await fetch(input.uri)).blob();
  } catch {
    throw new DocReadError('No se pudo abrir el archivo.');
  }
  if (!blob.size) throw new DocReadError('El archivo está vacío.');
  if (blob.size > LIMITS.maxBytes) throw new DocReadError(`El archivo pesa ${(blob.size / 1048576).toFixed(1)} MB. El máximo es 25 MB.`);
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  const mime = (input.mimeType || blob.type || '').toLowerCase();
  if (!isPdf && !mime.startsWith('image/') && !/\.(jpe?g|png|webp|gif|bmp|heic|heif|tiff?)$/i.test(input.name ?? '')) {
    throw new DocReadError('Formato no admitido. Usa PDF, JPG, PNG o WEBP.');
  }
  const lines: DocLine[] = [];
  const pages: PageInfo[] = [];
  const previews: string[] = [];
  const notes: string[] = [];
  let totalPages = 1;

  if (isPdf) {
    onProgress({ step: 'Leyendo el PDF…' });
    const pdfjsLib = await getPdfJs();
    let pdf: any;
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
    } catch (e: any) {
      if (e?.name === 'PasswordException') throw new DocReadError('El PDF está protegido con contraseña. Ábrelo, guárdalo sin contraseña y vuelve a intentarlo.');
      throw new DocReadError('El PDF está dañado o no se puede abrir.');
    }
    totalPages = pdf.numPages;
    const n = Math.min(totalPages, LIMITS.maxPdfPages);
    if (totalPages > n) notes.push(`El PDF tiene ${totalPages} páginas: se han leído las ${n} primeras.`);
    let ocrPages = 0;
    for (let p = 1; p <= n; p++) {
      checkAbort(signal);
      onProgress({ step: `Leyendo página ${p} de ${n}…`, fraction: (p - 1) / n });
      const page = await pdf.getPage(p);
      const { items, vertical, width, height } = await pdfPageItems(page, pdfjsLib);
      const pageLines = buildLines(items, p);
      const chars = pageLines.reduce((s, l) => s + l.text.replace(/\s/g, '').length, 0);
      const needsOcr = chars < 30;
      // Render (vista previa y, si hace falta, OCR)
      const scale = needsOcr ? 2.6 : 1.4;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const cctx = canvas.getContext('2d')!;
      cctx.fillStyle = '#fff';
      cctx.fillRect(0, 0, canvas.width, canvas.height);
      if (needsOcr || p <= 12) await page.render({ canvasContext: cctx, viewport }).promise;
      if (!needsOcr) {
        lines.push(...pageLines);
        vertical.forEach((v, i) => lines.push({ page: p, y: height + 10 + i * 10, h: 8, text: v, cells: [{ text: v, x0: 0, x1: 200 }] }));
        pages.push({ width, height, method: 'pdf-text' });
        if (p <= 12) previews.push(canvasToPreview(canvas));
      } else if (ocrPages < LIMITS.maxOcrPages) {
        ocrPages++;
        const r = await ocrCanvas(canvas, p, onProgress, signal);
        lines.push(...r.lines);
        pages.push(r.info);
        previews.push(r.preview);
      } else {
        notes.push(`Página ${p}: es una imagen escaneada y se ha superado el máximo de ${LIMITS.maxOcrPages} páginas con OCR; no se ha leído.`);
      }
    }
    if (ocrPages) notes.push(ocrPages === n ? 'El PDF es un escaneo: se ha leído con OCR. Revisa los datos con más cuidado.' : `${ocrPages} página(s) escaneadas leídas con OCR.`);
  } else {
    const canvas = await blobToCanvas(blob);
    checkAbort(signal);
    const r = await ocrCanvas(canvas, 1, onProgress, signal);
    lines.push(...r.lines);
    pages.push(r.info);
    previews.push(r.preview);
    if (r.info.rotation) notes.push(`La imagen estaba girada; se ha leído rotándola ${r.info.rotation}°.`);
  }
  checkAbort(signal);
  const lowQ = pages.map((pg, i) => ({ pg, i })).filter(x => x.pg.method === 'ocr' && (x.pg.ocrConfidence ?? 0) < 75);
  if (lowQ.length) notes.push(`Calidad de lectura baja en ${lowQ.length === 1 ? `la página ${lowQ[0].i + 1}` : `${lowQ.length} páginas`}: puede haber letras o números mal leídos.`);
  if (!lines.length) throw new DocReadError('No se ha encontrado texto en el documento. Si es una foto, hazla con más luz, recta y enfocada.');
  onProgress({ step: 'Interpretando los datos…', fraction: 1 });
  const parsed = parseDocument(lines, ctx);
  return { read: { lines, pages, totalPages, previews, notes }, parsed };
}
