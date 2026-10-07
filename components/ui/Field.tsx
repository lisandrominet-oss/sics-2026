import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// Etiqueta + campo + ayuda/error. `children` recibe el id para enlazar la etiqueta con el campo.
// Se adopta pantalla por pantalla en la Fase 2; hoy los formularios usan `inputClass` de lib/ui.ts.
export default function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children({ id, "aria-describedby": note ? noteId : undefined, "aria-invalid": error ? true : undefined })}
      {note && (
        <p id={noteId} className={cn("mt-1 text-xs", error ? "text-red-600" : "text-slate-500")}>
          {note}
        </p>
      )}
    </div>
  );
}
