/** Utilidades de datos españoles: NIF/CIF/NIE con letra de control, provincias por CP. */

const NIF_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function cleanTaxId(raw: string): string {
  return raw.toUpperCase().replace(/^ES[\s-]?/, '').replace(/[\s.\-\/]/g, '');
}

/** true/false si se puede validar; null si no es un formato español conocido. */
export function validateSpanishTaxId(raw: string): boolean | null {
  const v = cleanTaxId(raw);
  if (/^\d{8}[A-Z]$/.test(v)) return NIF_LETTERS[parseInt(v.slice(0, 8), 10) % 23] === v[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const n = parseInt(('XYZ'.indexOf(v[0]) + v.slice(1, 8)), 10);
    return NIF_LETTERS[n % 23] === v[8];
  }
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const digits = v.slice(1, 8);
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      let d = parseInt(digits[i], 10);
      if (i % 2 === 0) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    const control = (10 - (sum % 10)) % 10;
    const letter = 'JABCDEFGHI'[control];
    const last = v[8];
    const first = v[0];
    if ('PQRSNW'.includes(first)) return last === letter;
    if ('ABEH'.includes(first)) return last === String(control);
    return last === String(control) || last === letter;
  }
  return null;
}

/**
 * Busca identificadores fiscales en un texto.
 * Devuelve el texto tal cual aparece y si la letra/dígito de control es correcta.
 */
export function findTaxIds(text: string): { raw: string; clean: string; valid: boolean | null; labelled: boolean }[] {
  const out: { raw: string; clean: string; valid: boolean | null; labelled: boolean }[] = [];
  const seen = new Set<string>();
  const re =
    /(?:\b(N\.?\s?I\.?\s?F\.?|C\.?\s?I\.?\s?F\.?|N\.?\s?I\.?\s?E\.?|VAT(?:\s*(?:No|Nº|number|ID))?|NIF-?IVA|DNI|Tax\s*ID)\.?\s*[:.\-nº°]*\s*)?((?:ES[\s-]?)?(?:[ABCDEFGHJNPQRSUVW][\s.\-]?\d{2}[\s.]?\d{3}[\s.]?\d{2}[\s.\-]?[0-9A-J]|\d{2}[\s.]?\d{3}[\s.]?\d{3}[\s.\-]?[A-Z]|[XYZ][\s.\-]?\d{7}[\s.\-]?[A-Z]))(?![A-Za-z0-9])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[2].trim();
    const clean = cleanTaxId(raw);
    if (seen.has(clean)) continue;
    // Evitar falsos positivos: 8 dígitos + letra sin etiqueta dentro de números largos
    seen.add(clean);
    out.push({ raw, clean, valid: validateSpanishTaxId(clean), labelled: !!m[1] });
  }
  // Identificadores IVA europeos con etiqueta (FR, PT, IT, DE…)
  const eu = /\b(?:VAT|NIF|CIF|TVA|IVA|USt-?IdNr|P\.?\s?IVA)\.?\s*(?:No|Nº|ID|number)?\s*[:.]?\s*((?!ES)[A-Z]{2}[\s-]?[A-Z0-9]{8,12})\b/gi;
  while ((m = eu.exec(text))) {
    const clean = m[1].replace(/[\s-]/g, '').toUpperCase();
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push({ raw: m[1], clean, valid: null, labelled: true });
  }
  return out;
}

export const PROVINCES: Record<string, string> = {
  '01': 'Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería', '05': 'Ávila', '06': 'Badajoz',
  '07': 'Illes Balears', '08': 'Barcelona', '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón',
  '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca', '17': 'Girona', '18': 'Granada',
  '19': 'Guadalajara', '20': 'Gipuzkoa', '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León',
  '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid', '29': 'Málaga', '30': 'Murcia',
  '31': 'Navarra', '32': 'Ourense', '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra',
  '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria', '40': 'Segovia', '41': 'Sevilla',
  '42': 'Soria', '43': 'Tarragona', '44': 'Teruel', '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid',
  '48': 'Bizkaia', '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla',
};

const PROVINCE_ALIASES: Record<string, string> = {
  alava: 'Álava', araba: 'Álava', alicante: 'Alicante', alacant: 'Alicante', baleares: 'Illes Balears',
  'illes balears': 'Illes Balears', 'islas baleares': 'Illes Balears', castellon: 'Castellón', castello: 'Castellón',
  'la coruna': 'A Coruña', 'a coruna': 'A Coruña', coruna: 'A Coruña', gerona: 'Girona', guipuzcoa: 'Gipuzkoa',
  lerida: 'Lleida', orense: 'Ourense', vizcaya: 'Bizkaia', biscay: 'Bizkaia', tenerife: 'Santa Cruz de Tenerife',
  'gran canaria': 'Las Palmas', 'valencia/valencia': 'Valencia', 'valencia/valència': 'Valencia', valencia_: 'Valencia',
};

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Devuelve el nombre de provincia normalizado si el texto es una provincia española. */
export function matchProvince(text: string): string | null {
  const t = stripAccents(text.trim().toLowerCase()).replace(/[().]/g, '').trim();
  if (!t) return null;
  if (PROVINCE_ALIASES[t]) return PROVINCE_ALIASES[t];
  for (const name of Object.values(PROVINCES)) {
    if (stripAccents(name.toLowerCase()) === t) return name;
  }
  return null;
}

export function provinceFromPostalCode(cp: string): string | null {
  if (!/^\d{5}$/.test(cp)) return null;
  return PROVINCES[cp.slice(0, 2)] ?? null;
}

export const COUNTRIES = [
  'España', 'Spain', 'Portugal', 'Francia', 'France', 'Italia', 'Italy', 'Alemania', 'Germany', 'Deutschland',
  'Andorra', 'Reino Unido', 'United Kingdom', 'UK', 'Bélgica', 'Belgium', 'Países Bajos', 'Holanda', 'Netherlands',
  'Suiza', 'Switzerland', 'Austria', 'Irlanda', 'Ireland', 'Polonia', 'Poland', 'Marruecos', 'Morocco', 'México',
  'Mexico', 'Estados Unidos', 'USA', 'Chile', 'Argentina', 'Colombia', 'Perú',
];

export function matchCountry(text: string): string | null {
  const t = stripAccents(text.trim().toLowerCase()).replace(/[.()]/g, '');
  for (const c of COUNTRIES) {
    if (stripAccents(c.toLowerCase()) === t) return c === 'Spain' ? 'España' : c;
  }
  return null;
}
