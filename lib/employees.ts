import type { Database } from "@/lib/database.types";
import type { BadgeTone } from "@/components/ui/Badge";

export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type EmployeeWithPlant = Employee & { plant: { name: string; prefix: string } | null };
export type EmployeeStatus = "activo" | "licencia" | "baja";

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  activo: "Activo",
  licencia: "En licencia",
  baja: "Baja",
};

export const EMPLOYEE_STATUS_TONES: Record<EmployeeStatus, BadgeTone> = {
  activo: "success",
  licencia: "warning",
  baja: "muted",
};

export const EMPLOYEE_EVENT_LABELS: Record<string, string> = {
  alta: "Alta",
  edicion: "Edición de datos",
  baja: "Baja",
  reactivacion: "Reactivación",
  licencia: "Inicio de licencia",
  fin_licencia: "Fin de licencia",
  exportacion: "Exportación del listado",
};

// Campos del legajo, en el orden en que se muestran (también sirve para describir qué cambió en una edición).
export const EMPLOYEE_FIELD_LABELS: Record<string, string> = {
  legajo: "Legajo",
  last_name: "Apellido",
  first_name: "Nombre",
  dni: "DNI",
  cuil: "CUIL",
  birth_date: "Fecha de nacimiento",
  hire_date: "Fecha de ingreso",
  termination_date: "Fecha de baja",
  status: "Estado",
  position: "Puesto",
  job_category: "Categoría",
  plant_id: "Área",
  profile_id: "Usuario vinculado",
};

export function employeeName(e: Pick<Employee, "last_name" | "first_name">) {
  return `${e.last_name}, ${e.first_name}`;
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

// 12345678 -> 12.345.678
export function formatDni(dni: string | null) {
  if (!dni) return "-";
  return dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// 20123456789 -> 20-12345678-9
export function formatCuil(cuil: string | null) {
  if (!cuil) return "-";
  return cuil.length === 11 ? `${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil.slice(10)}` : cuil;
}

// Mismo criterio que is_valid_cuil() en la base: prefijo de persona y dígito verificador (módulo 11).
export function isValidCuil(cuil: string): boolean {
  if (!/^\d{11}$/.test(cuil)) return false;
  if (!["20", "23", "24", "25", "26", "27"].includes(cuil.slice(0, 2))) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + Number(cuil[i]) * w, 0);
  const rest = sum % 11;
  // Resto 1 no tiene dígito posible (se cambia el prefijo a 23 y se recalcula): ese número no es un CUIL.
  if (rest === 1) return false;
  const check = rest === 0 ? 0 : 11 - rest;
  return Number(cuil[10]) === check;
}

// Devuelve el mensaje de error de un par DNI/CUIL, o null si está bien (el CUIL lleva el DNI adentro).
export function dniCuilError(dniRaw: string, cuilRaw: string): string | null {
  const dni = digitsOnly(dniRaw).replace(/^0+/, "");
  const cuil = digitsOnly(cuilRaw);
  if (dniRaw.trim() && !/^\d{6,8}$/.test(dni)) return "El DNI debe tener entre 6 y 8 dígitos";
  if (!cuilRaw.trim()) return null;
  if (!isValidCuil(cuil)) return "El CUIL no es válido (revisá el dígito verificador)";
  if (dni && cuil.slice(2, 10) !== dni.padStart(8, "0")) return "El CUIL no coincide con el DNI";
  return null;
}

// ---------------------------------------------------------------- importación por CSV
// Columnas que se aceptan en el archivo (se comparan sin tildes ni mayúsculas) y a qué campo van.
const CSV_HEADERS: Record<string, string> = {
  legajo: "legajo",
  apellido: "last_name",
  apellidos: "last_name",
  nombre: "first_name",
  nombres: "first_name",
  dni: "dni",
  documento: "dni",
  cuil: "cuil",
  cuit: "cuil",
  "fecha de nacimiento": "birth_date",
  nacimiento: "birth_date",
  "fecha nacimiento": "birth_date",
  "fecha de ingreso": "hire_date",
  ingreso: "hire_date",
  "fecha ingreso": "hire_date",
  puesto: "position",
  cargo: "position",
  categoria: "job_category",
  area: "area",
  planta: "area",
  sector: "area",
};

export const CSV_TEMPLATE_HEADERS = [
  "Legajo",
  "Apellido",
  "Nombre",
  "DNI",
  "CUIL",
  "Fecha de nacimiento",
  "Fecha de ingreso",
  "Puesto",
  "Categoría",
  "Área",
];

export type ImportRow = {
  legajo?: string;
  last_name?: string;
  first_name?: string;
  dni?: string;
  cuil?: string;
  birth_date?: string;
  hire_date?: string;
  position?: string;
  job_category?: string;
  area?: string;
};

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Lee un CSV (separador coma, punto y coma o tabulación; comillas dobles; con o sin BOM).
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch as keyof typeof counts] += 1;
  }
  const delimiter = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ";") as string;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// 15/03/2020 o 15-3-2020 -> 2020-03-15. Lo que ya viene en formato ISO se respeta; lo que no se entiende
// se devuelve tal cual para que la base lo rechace con su mensaje.
export function toIsoDate(value: string): string {
  const v = value.trim();
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (!m) return v;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export type CsvParseResult =
  | { ok: true; rows: ImportRow[]; ignoredColumns: string[] }
  | { ok: false; error: string };

export function csvToImportRows(text: string): CsvParseResult {
  const table = parseCsv(text);
  if (table.length < 2) return { ok: false, error: "El archivo no tiene filas de datos (solo encabezado o está vacío)." };
  const [header, ...body] = table;
  const fields = header.map((h) => CSV_HEADERS[normalizeHeader(h)] ?? null);
  const ignoredColumns = header.filter((_, i) => !fields[i]).map((h) => h.trim()).filter(Boolean);
  const present = new Set(fields.filter(Boolean));
  const missing = [
    ["last_name", "Apellido"],
    ["first_name", "Nombre"],
    ["dni", "DNI"],
  ].filter(([key]) => !present.has(key));
  if (missing.length > 0) {
    return { ok: false, error: `Faltan columnas obligatorias en el encabezado: ${missing.map(([, label]) => label).join(", ")}.` };
  }
  if (body.length > 1000) return { ok: false, error: "El archivo tiene más de 1000 filas: dividilo en partes." };

  const rows = body.map((cells) => {
    const row: Record<string, string> = {};
    fields.forEach((field, i) => {
      if (!field) return;
      const raw = (cells[i] ?? "").trim();
      row[field] = field === "birth_date" || field === "hire_date" ? toIsoDate(raw) : raw;
    });
    return row as ImportRow;
  });
  return { ok: true, rows, ignoredColumns };
}

// AAAA-MM-DD y que el día exista en el calendario (no 2020-02-31).
function isRealIsoDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

// Controles previos al envío (los definitivos los hace la base): obligatorios, DNI, CUIL y fechas.
export function importRowError(row: ImportRow): string | null {
  if (!row.last_name || !row.first_name) return "Apellido y nombre son obligatorios";
  if (!row.dni) return "El DNI es obligatorio";
  const idError = dniCuilError(row.dni, row.cuil ?? "");
  if (idError) return idError;
  for (const [label, value] of [["nacimiento", row.birth_date], ["ingreso", row.hire_date]] as const) {
    if (value && !isRealIsoDate(value)) return `Fecha de ${label} inválida (usá dd/mm/aaaa)`;
  }
  return null;
}

// Plantilla: solo el encabezado (sin datos de ejemplo, para que nadie importe una fila de muestra por error).
export function csvTemplate() {
  return "\uFEFF" + CSV_TEMPLATE_HEADERS.join(";") + "\r\n";
}

// El CSV de Excel en español suele venir en Windows-1252; si no es UTF-8 válido, se reintenta con esa.
export async function readCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}
