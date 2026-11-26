import type { Order } from '@/types';

/**
 * Referencia propia de la empresa (campo «Ref. manual», `custom_reference`): CÓDIGO-número, sin año
 * (p. ej. ESP-620). El año se muestra aparte, entre paréntesis. La referencia automática
 * (`reference_number`, CÓDIGO-AÑO-NNN) sigue existiendo y es la que se ve si no hay referencia propia.
 */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Número de la referencia propia: «ESP-605», «ESP605», «605» → 605. Otro texto → null. */
export function manualRefNumber(custom: string | null | undefined, code: string): number | null {
  const v = (custom || '').trim().toUpperCase();
  if (!v) return null;
  const m = v.match(new RegExp(`^(?:${esc(code.toUpperCase())}\\s*[-–]?\\s*)?(\\d+)$`));
  return m ? parseInt(m[1], 10) : null;
}

/** Texto que se guarda: si solo hay número, se le pone el código delante (628 → ESP-628). */
export function normalizeManualRef(input: string, code: string): string {
  const v = input.trim().toUpperCase();
  if (!v || !code) return v;
  const n = manualRefNumber(v, code);
  return n === null ? v : `${code.toUpperCase()}-${n}`;
}

/** Lo que va detrás del «ESP-» en el campo: 628 de «ESP-628»; el texto libre se deja tal cual. */
export function manualRefSuffix(custom: string | null | undefined, code: string): string {
  const v = (custom || '').trim();
  if (!v) return '';
  const n = manualRefNumber(v, code);
  return n === null ? v : String(n);
}

/** Siguiente referencia propia del código: la más alta guardada + 1 (todas las referencias, de cualquier año). */
export function nextManualRef(orders: Pick<Order, 'id' | 'manufacturer_code' | 'custom_reference'>[], code: string, excludeId?: string): { number: number; last: string } | null {
  if (!code) return null;
  let max = 0;
  for (const o of orders) {
    if (o.id === excludeId || (o.manufacturer_code || '').toUpperCase() !== code.toUpperCase()) continue;
    const n = manualRefNumber(o.custom_reference, code);
    if (n !== null && n > max) max = n;
  }
  return max ? { number: max + 1, last: `${code.toUpperCase()}-${max}` } : null;
}

/** Referencia principal que se enseña: la propia (ESP-620) o, si no hay, la automática. */
export function orderRef(o: Pick<Order, 'reference_number' | 'custom_reference' | 'manufacturer_code'>): { ref: string; manual: boolean } {
  const c = (o.custom_reference || '').trim();
  if (c) return { ref: normalizeManualRef(c, o.manufacturer_code || ''), manual: true };
  return { ref: o.reference_number, manual: false };
}

/** «ESP-620 (2026)»; con la automática no se repite el año, que ya lleva dentro. */
export function orderRefLabel(o: Pick<Order, 'reference_number' | 'custom_reference' | 'manufacturer_code' | 'year'>): string {
  const r = orderRef(o);
  return r.manual && o.year ? `${r.ref} (${o.year})` : r.ref;
}
