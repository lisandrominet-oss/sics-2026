"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { useFileDrop } from "@/lib/useFileDrop";
import { IconUpload } from "@/components/icons";
import Button from "./Button";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Zona para adjuntar un archivo: se puede arrastrar desde una carpeta (Descargas) o hacer clic para
// elegirlo. Es una <label> con un input real (oculto visualmente), así que el teclado y los lectores
// de pantalla siguen funcionando. Si se pasa `value` (+ `onClear`) el archivo elegido se muestra
// en la zona; sin `value` solo avisa con `onFile` (para cargas que se suben apenas se elige).
export default function FileDropzone({
  onFile,
  value,
  onClear,
  accept,
  disabled = false,
  compact = false,
  existingFileName,
  loading = false,
  className,
}: {
  onFile: (file: File) => void;
  value?: File | null;
  onClear?: () => void;
  accept?: string;
  disabled?: boolean;
  /** Versión baja, para formularios apretados. */
  compact?: boolean;
  /** Nombre de un archivo ya subido que se reemplaza si se elige otro. */
  existingFileName?: string | null;
  loading?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isDragging, dropProps } = useFileDrop({
    onFiles: (files) => onFile(files[0]),
    accept,
    disabled: disabled || loading,
  });

  // Al quitar el archivo desde afuera (o tras enviar el formulario) se vacía el input real,
  // para que volver a elegir el mismo archivo dispare el cambio.
  useEffect(() => {
    if (value === null && inputRef.current) inputRef.current.value = "";
  }, [value]);

  const blocked = disabled || loading;

  return (
    <div className={cn("mt-1", className)}>
      <div className="flex items-stretch gap-2">
        <label
          {...dropProps}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-dashed text-left transition-colors duration-fast ease-out-expo",
            compact ? "px-3 py-2" : "px-4 py-4",
            "[&>*]:pointer-events-none focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate-900",
            isDragging
              ? "border-slate-900 bg-slate-100 text-slate-900"
              : "border-slate-300 text-slate-500 hover:border-slate-500 hover:bg-slate-50",
            blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={blocked}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              // Sin `value` (carga inmediata) se vacía para poder volver a elegir el mismo archivo.
              if (value === undefined) e.target.value = "";
            }}
          />
          <IconUpload className={cn("shrink-0", compact ? "h-4 w-4" : "h-5 w-5")} />
          <span className="min-w-0 text-xs [overflow-wrap:anywhere]">
            {isDragging ? (
              <span className="font-medium">Soltalo acá</span>
            ) : loading ? (
              <span>Subiendo…</span>
            ) : value ? (
              <>
                <span className="font-medium text-slate-700">{value.name}</span>{" "}
                <span className="text-slate-500">({formatSize(value.size)})</span>
                <span className="block text-slate-500">
                  <span className="[@media(hover:none)]:hidden">Soltá otro archivo o hacé clic para cambiarlo</span>
                  <span className="hidden [@media(hover:none)]:inline">Tocá para cambiarlo</span>
                </span>
              </>
            ) : (
              <>
                <span className="[@media(hover:none)]:hidden">Arrastrá el archivo acá o hacé clic para elegirlo</span>
                <span className="hidden [@media(hover:none)]:inline">Tocá para elegir un archivo</span>
              </>
            )}
          </span>
        </label>
        {value && onClear && (
          <Button variant="link-danger" size="sm" onClick={onClear} disabled={blocked} aria-label={`Quitar archivo ${value.name}`} className="shrink-0">
            Quitar
          </Button>
        )}
      </div>
      {existingFileName && !value && (
        <p className="mt-1 text-xs text-slate-500 [overflow-wrap:anywhere]">
          Ya subido: {existingFileName} (se reemplaza si elegís otro)
        </p>
      )}
    </div>
  );
}

// Capa que tapa una fila mientras se arrastra un archivo encima (para filas que ya tienen su propio
// botón de "Agregar"). No captura el mouse, así que no altera los eventos de arrastre. El contenedor debe ser `relative`.
export function DropOverlay({ text = "Soltá para agregar" }: { text?: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 flex animate-fade-in items-center justify-center gap-2 rounded-[inherit] border border-dashed border-slate-900 bg-slate-100 text-sm font-medium text-slate-900"
    >
      <IconUpload className="h-4 w-4" />
      {text}
    </div>
  );
}
