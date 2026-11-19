// Lectura de CSV y de filas pegadas desde una planilla (Google Sheets o Excel).
// Se usa en la importación de Personal y en "Importar desde planilla" de la SIC nueva.
// No se usa `XLSX.read` a propósito (ver lib/exportSics.ts): solo se lee texto.

export type CsvDelimiter = ";" | "," | "\t";

// Lee un CSV (separador coma, punto y coma o tabulación; comillas dobles; con o sin BOM).
// Sin `delimiter`, se deduce por el que más aparece en la primera línea.
export function parseCsv(text: string, delimiter?: CsvDelimiter): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  if (!delimiter) {
    const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
    const counts = { ";": 0, ",": 0, "\t": 0 };
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch in counts) counts[ch as keyof typeof counts] += 1;
    }
    delimiter = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ";") as CsvDelimiter;
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      // Las comillas solo abren un campo al principio: `Caño 1/2"` queda tal cual.
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

// Texto pegado desde una planilla: si trae tabulaciones son las columnas (así copian Sheets y Excel),
// aunque alguna celda tenga comas o punto y coma adentro.
export function parsePastedTable(text: string): string[][] {
  return parseCsv(text, text.includes("\t") ? "\t" : undefined);
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

// Descarga un texto como archivo .csv (con BOM, para que Excel respete los acentos).
export function downloadCsv(fileName: string, content: string) {
  const blob = new Blob([content.startsWith("\uFEFF") ? content : "\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  // Safari (iPhone) puede cancelar la descarga si la URL se libera en el mismo momento.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
