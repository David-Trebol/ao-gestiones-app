/** Tipos de la lectura local de documentos (sin IA ni servicios externos). */

export interface Cell {
  text: string;
  x0: number;
  x1: number;
}

/** Una línea visual del documento, con sus "celdas" (trozos separados por huecos grandes). */
export interface DocLine {
  page: number; // 1..n
  y: number; // posición vertical (de arriba a abajo, en px de la página)
  h: number; // altura aproximada del texto
  text: string; // celdas unidas con "   "
  cells: Cell[];
  conf?: number; // confianza del OCR (0-100) si viene de OCR
}

export interface PageInfo {
  width: number;
  height: number;
  method: 'pdf-text' | 'ocr';
  ocrConfidence?: number;
  rotation?: number; // grados aplicados para leerla (OCR)
}

export interface ReadResult {
  lines: DocLine[];
  pages: PageInfo[];
  totalPages: number; // páginas del archivo (puede ser > pages.length si se limitó)
  previews: string[]; // imágenes (data URL) para revisar el documento
  notes: string[]; // avisos de la lectura (límites, calidad…)
}

export type FieldStatus = 'ok' | 'doubtful' | 'derived';

export interface Field<T = string> {
  value: T;
  status: FieldStatus;
  /** Texto del documento de donde sale el dato */
  source?: string;
  page?: number;
  note?: string;
}

export const PARTY_KEYS = [
  'nombre_empresa',
  'contacto',
  'departamento',
  'direccion_1',
  'direccion_2',
  'codigo_postal',
  'poblacion',
  'provincia',
  'pais',
  'telefono_1',
  'telefono_2',
  'email',
  'nif',
] as const;
export type PartyKey = (typeof PARTY_KEYS)[number];

export interface Party {
  /** Texto del bloque tal cual (para que el usuario lo compare) */
  block: string[];
  page?: number;
  /** Etiqueta que lo identificó: "Cliente", "Facturar a"… */
  label?: string;
  fields: Partial<Record<PartyKey, Field>>;
}

export type DocType = 'pedido' | 'oferta' | 'proforma' | 'factura' | 'albaran' | 'confirmacion' | 'otro';

export interface ParsedLine {
  code?: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null; // sin IVA, antes de descuento
  discount: number | null; // %
  netUnitPrice: number | null; // precio unitario neto si aparece
  amount: number | null; // importe de la línea tal cual aparece
  vat: number | null; // %
  isShipping: boolean;
  page: number;
  source: string;
  /** ok = cantidad × precio × (1 − dto) cuadra con el importe */
  check: 'ok' | 'mismatch' | 'incomplete';
  note?: string;
  duplicateOf?: number;
}

export interface ParsedDoc {
  docType: DocType;
  docTypeSource?: string;
  issuer: Party;
  recipient: Party;
  /** Quién parece ser el cliente del pedido */
  customerIs: 'issuer' | 'recipient';
  customerConfident: boolean;
  customerReason: string;
  /** Fabricante existente que aparece en el documento (si coincide) */
  manufacturerMatch?: { id: string; name: string; party: 'issuer' | 'recipient' };
  refs: {
    numero_documento?: Field;
    numero_pedido_cliente?: Field;
    oferta_proforma?: Field;
    numero_factura?: Field;
    numero_albaran?: Field;
    fecha?: Field;
  };
  condiciones_entrega?: Field;
  condiciones_pago?: Field;
  lines: ParsedLine[];
  totals: {
    base?: Field<number>;
    vatAmount?: Field<number>;
    vatRate?: Field<number>;
    total?: Field<number>;
  };
  linesSum: number;
  currency: string;
  warnings: string[];
  /** Otras direcciones vistas (p. ej. dirección de entrega distinta) */
  otherAddresses: string[];
}

export interface ParseContext {
  manufacturers?: { id: string; name: string; code?: string }[];
  knownCustomers?: { name: string; nif: string }[];
  ownNames?: string[];
}
