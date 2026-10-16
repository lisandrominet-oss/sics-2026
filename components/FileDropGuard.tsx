"use client";

import { useEffect } from "react";
import { FILE_DROP_ATTR, FILE_DROP_DISABLED_ATTR } from "@/lib/useFileDrop";

// Si se suelta un archivo fuera de una zona de carga, el navegador lo abre en la misma pestaña y se pierde
// lo que se estaba cargando (por ejemplo una SIC a medio completar). Esto lo evita y muestra el cursor de "no se puede".
export default function FileDropGuard() {
  useEffect(() => {
    const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const inZone = (e: DragEvent) => e.target instanceof Element && !!e.target.closest(`[${FILE_DROP_ATTR}]:not([${FILE_DROP_DISABLED_ATTR}])`);

    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      if (!inZone(e) && e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    const onDrop = (e: DragEvent) => {
      if (isFileDrag(e)) e.preventDefault();
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return null;
}
