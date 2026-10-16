"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { notify } from "@/lib/notify";

// Atributo con el que se marca toda zona de soltar; FileDropGuard lo usa para saber dónde sí se puede soltar.
export const FILE_DROP_ATTR = "data-file-drop";
// Zona que existe pero hoy no acepta archivos (cargando, sin permiso): el guard la trata como "fuera".
export const FILE_DROP_DISABLED_ATTR = "data-file-drop-disabled";

// ¿El archivo cumple con un `accept` de input (ej. "image/*", ".pdf", "application/pdf")? Sin `accept` pasa todo.
function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return accept
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .some((p) => {
      if (p.startsWith(".")) return name.endsWith(p);
      // Algunos archivos (ej. HEIC) llegan sin tipo; se dejan pasar y valida quien recibe el archivo.
      if (p.endsWith("/*")) return type === "" || type.startsWith(p.slice(0, -1));
      return type === p;
    });
}

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

type Options = {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
};

// Zona de soltar archivos (arrastrar desde Finder/Descargas). Devuelve `isDragging` para resaltar
// y `dropProps` para esparcir sobre el contenedor. Descarta carpetas, filtra por `accept` y,
// si la zona acepta un solo archivo, toma el primero y avisa de los demás.
export function useFileDrop({ onFiles, multiple = false, accept, disabled = false }: Options) {
  const [isDragging, setIsDragging] = useState(false);
  // Contador de entradas: dragenter/dragleave se disparan también al pasar sobre los hijos.
  const depth = useRef(0);

  const reset = useCallback(() => {
    depth.current = 0;
    setIsDragging(false);
  }, []);

  const onDragEnter = (e: DragEvent) => {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (e: DragEvent) => {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (e: DragEvent) => {
    if (disabled || !hasFiles(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setIsDragging(false);
  };

  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    reset();
    if (disabled) return;

    // Las carpetas hay que detectarlas durante el evento (después `items` queda vacío).
    const files: File[] = [];
    let skippedFolders = 0;
    const items = Array.from(e.dataTransfer.items ?? []).filter((i) => i.kind === "file");
    if (items.length > 0) {
      for (const item of items) {
        if (item.webkitGetAsEntry?.()?.isDirectory) {
          skippedFolders += 1;
          continue;
        }
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    } else {
      files.push(...Array.from(e.dataTransfer.files));
    }

    if (skippedFolders > 0) {
      notify.warning(
        skippedFolders === 1 ? "No se puede soltar una carpeta" : "No se pueden soltar carpetas",
        "Soltá archivos sueltos (si hace falta, comprimí la carpeta en un .zip)."
      );
    }

    const valid = files.filter((f) => matchesAccept(f, accept));
    if (valid.length < files.length) {
      notify.warning(
        "Tipo de archivo no permitido",
        accept === "image/*" ? "Acá solo se aceptan imágenes." : "Ese tipo de archivo no se acepta acá."
      );
    }
    if (valid.length === 0) return;

    if (!multiple && valid.length > 1) {
      notify.info(
        "Se tomó solo el primer archivo",
        `Acá entra un archivo por vez; ${valid.length - 1 === 1 ? "se ignoró 1 más" : `se ignoraron ${valid.length - 1} más`}.`
      );
      onFiles([valid[0]]);
      return;
    }
    onFiles(valid);
  };

  return {
    isDragging: isDragging && !disabled,
    dropProps: { [FILE_DROP_ATTR]: "", [FILE_DROP_DISABLED_ATTR]: disabled ? "" : undefined, onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
