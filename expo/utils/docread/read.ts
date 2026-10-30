/**
 * Versión para la app nativa (iOS/Android): la lectura local usa PDF.js y OCR en WebAssembly,
 * que solo están disponibles en la versión web. Aquí se informa con claridad.
 */
import { ParseContext, ParsedDoc, ReadResult } from './types';

export const DOC_READ_SUPPORTED = false;
export const LIMITS = { maxBytes: 25 * 1024 * 1024, maxPdfPages: 30, maxOcrPages: 8 };
export class DocReadError extends Error {}
export type Progress = (p: { step: string; fraction?: number }) => void;
export interface ReadInput {
  uri: string;
  mimeType?: string;
  name?: string;
}

export async function readDocument(
  _input: ReadInput,
  _ctx: ParseContext,
  _onProgress: Progress,
  _signal?: { aborted: boolean },
): Promise<{ read: ReadResult; parsed: ParsedDoc }> {
  throw new DocReadError('La lectura de documentos está disponible en la versión web de la app (ao-gestiones-pedidos.vercel.app).');
}

export async function releaseReader() {}
