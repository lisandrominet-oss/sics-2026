// "Importar desde planilla": convierte las filas que el operario copia de su Google Sheets
// (o un CSV descargado de ahí) en artículos para el formulario de SIC nueva.
// Solo arma borradores: la SIC se sigue creando con `create_sic`, después de revisar el formulario.

import type { ItemDraft } from "@/components/ItemsEditor";
import { parseCsv, parsePastedTable } from "@/lib/csv";

type Field = "description" | "quantity" | "unit" | "specs" | "link" | "cert" | "sic";

// Columnas de la plantilla, en el orden que se asume si lo pegado no trae encabezado.
export const ITEMS_TEMPLATE_HEADERS = ["Artículo", "Cantidad", "Unidad", "Características", "Link", "Cert. calidad", "SIC"];
const TEMPLATE_ORDER: Field[] = ["description", "quantity", "unit", "specs", "link", "cert", "sic"];

// Encabezados reconocidos (en minúscula, sin acentos ni signos).
const HEADER_FIELDS: Record<string, Field> = {
  articulo: "description",
  articulos: "description",
  item: "description",
  items: "description",
  descripcion: "description",
  producto: "description",
  material: "description",
  materiales: "description",
  insumo: "description",
  repuesto: "description",
  cantidad: "quantity",
  cantidades: "quantity",
  cant: "quantity",
  unidad: "unit",
  unidades: "unit",
  unid: "unit",
  un: "unit",
  um: "unit",
  "unidad de medida": "unit",
  caracteristicas: "specs",
  caracteristica: "specs",
  especificaciones: "specs",
  "especificaciones tecnicas": "specs",
  especificacion: "specs",
  detalle: "specs",
  detalles: "specs",
  observaciones: "specs",
  link: "link",
  links: "link",
  "link de referencia": "link",
  url: "link",
  enlace: "link",
  "cert calidad": "cert",
  certificado: "cert",
  "certificado de calidad": "cert",
  "requiere certificado": "cert",
  "requiere certificado de calidad": "cert",
  sic: "sic",
  "sic cargada": "sic",
  codigo: "sic",
};

export type ImportedItem = {
  draft: ItemDraft;
  /** Motivo por el que la fila no se puede usar tal cual (falta el artículo, cantidad inválida…). */
  error: string | null;
  /** Algo para revisar aunque la fila sea válida (ej. "1.500" se leyó como mil quinientos). */
  warning: string | null;
  /** Lo que el operario anotó en la columna "SIC": si hay algo, esa fila ya se cargó. */
  sicCode: string;
};

export type ImportItemsResult =
  | { ok: true; items: ImportedItem[]; ignoredColumns: string[]; hasHeader: boolean }
  | { ok: false; error: string };

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Cantidad escrita a la argentina: "2,5" → 2.5; "1.000" o "1.000,5" → miles; "0.500" o "1.5" → decimal.
// Acepta la unidad pegada al número ("10 m", "3un") y la devuelve aparte.
// `ambiguous`: "1.500" sin coma puede ser mil quinientos o uno y medio; se toma como miles y se avisa.
export function parseQuantity(raw: string): { value: number | null; unit: string; ambiguous: boolean } {
  const m = /^([\d.,]+)\s*([A-Za-zÀ-ÿ].*)?$/.exec(raw.trim());
  if (!m) return { value: null, unit: "", ambiguous: false };
  let num = m[1];
  const unit = (m[2] ?? "").trim();
  let ambiguous = false;
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(num)) {
    ambiguous = !num.includes(",");
    num = num.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d+$/.test(num)) num = num.replace(",", ".");
  else if (!/^\d+(\.\d+)?$/.test(num)) return { value: null, unit, ambiguous: false };
  const value = Number(num);
  return { value: Number.isFinite(value) ? value : null, unit, ambiguous };
}

function isYes(value: string) {
  const v = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return ["si", "s", "x", "true", "verdadero", "yes", "1"].includes(v);
}

// Una sola línea de cuadro de texto: Sheets conserva los saltos de línea de una celda.
function oneLine(value: string) {
  return value.replace(/\s*\r?\n\s*/g, " ").trim();
}

function rowToItem(cells: string[], fields: (Field | null)[]): ImportedItem {
  const get = (field: Field) => {
    const i = fields.indexOf(field);
    return i === -1 ? "" : (cells[i] ?? "").trim();
  };
  const description = oneLine(get("description"));
  const rawQuantity = get("quantity");
  const { value: quantity, unit: unitInQuantity, ambiguous } = parseQuantity(rawQuantity);
  const unit = oneLine(get("unit")) || unitInQuantity;
  const specs = get("specs");
  // `sic_items` no tiene unidad: se guarda al principio de las especificaciones.
  const fullSpecs = [unit ? `Unidad: ${unit}` : "", specs].filter(Boolean).join(" · ");

  let error: string | null = null;
  if (!description) error = "Falta el artículo";
  else if (!rawQuantity) error = "Falta la cantidad";
  else if (quantity === null || quantity <= 0) error = `Cantidad no válida: "${rawQuantity}"`;
  else if (!/^\d+(\.\d{1,2})?$/.test(String(quantity))) error = "La cantidad admite hasta 2 decimales";

  return {
    draft: {
      description,
      quantity: quantity !== null ? String(quantity) : "",
      specs: fullSpecs,
      referenceLink: oneLine(get("link")),
      file: null,
      requiresQualityCert: isYes(get("cert")),
    },
    error,
    warning: !error && ambiguous ? `"${rawQuantity}" se leyó como ${quantity}: si era con decimales, escribilo con coma` : null,
    sicCode: oneLine(get("sic")),
  };
}

function tableToItems(table: string[][]): ImportItemsResult {
  if (table.length === 0) return { ok: false, error: "No hay filas para importar." };

  const headerFields = table[0].map((h) => HEADER_FIELDS[normalizeHeader(h)] ?? null);
  // Es encabezado si nombra al menos dos columnas conocidas (una fila de datos no las nombra).
  const hasHeader = new Set(headerFields.filter(Boolean)).size >= 2;
  const fields = hasHeader ? headerFields : TEMPLATE_ORDER;
  const body = hasHeader ? table.slice(1) : table;

  if (!fields.includes("description")) {
    return { ok: false, error: "No encontré la columna del artículo. Usá el encabezado de la plantilla (Artículo, Cantidad…)." };
  }
  if (!fields.includes("quantity")) {
    return { ok: false, error: "No encontré la columna Cantidad. Usá el encabezado de la plantilla (Artículo, Cantidad…)." };
  }
  if (body.length === 0) return { ok: false, error: "Solo vino el encabezado: copiá también las filas de abajo." };
  if (body.length > 500) return { ok: false, error: "Son más de 500 filas: copiá solo las que vas a pedir." };

  const ignoredColumns = hasHeader
    ? table[0].filter((_, i) => !headerFields[i]).map((h) => h.trim()).filter(Boolean)
    : [];
  return { ok: true, items: body.map((cells) => rowToItem(cells, fields)), ignoredColumns, hasHeader };
}

/** Filas pegadas desde Google Sheets o Excel (separadas por tabulaciones). */
export function itemsFromPastedText(text: string): ImportItemsResult {
  return tableToItems(parsePastedTable(text));
}

/** Contenido de un CSV descargado de la planilla. */
export function itemsFromCsv(text: string): ImportItemsResult {
  return tableToItems(parseCsv(text));
}

/** Plantilla vacía (solo encabezado), separada por punto y coma para que Excel en español la abra en columnas. */
export function itemsTemplateCsv() {
  return "\uFEFF" + ITEMS_TEMPLATE_HEADERS.join(";") + "\r\n";
}
