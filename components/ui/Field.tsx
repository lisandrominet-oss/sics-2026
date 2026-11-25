import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import InfoTip from "./InfoTip";

// Etiqueta + campo + ayuda/error. `info`: aclaración detrás del ícono (i), al lado de la etiqueta. `children` recibe el id para enlazar la etiqueta con el campo.
// Se adopta pantalla por pantalla en la Fase 2; hoy los formularios usan `inputClass` de lib/ui.ts.
export default function Field({
  label,
  hint,
  info,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  info?: ReactNode;
  error?: string | null;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={className}>
      {info ? (
        <div className="flex items-center gap-1.5">
          <label htmlFor={id} className="block text-sm font-medium text-slate-900">
            {label}
          </label>
          <InfoTip>{info}</InfoTip>
        </div>
      ) : (
        <label htmlFor={id} className="block text-sm font-medium text-slate-900">
          {label}
        </label>
      )}
      {children({ id, "aria-describedby": note ? noteId : undefined, "aria-invalid": error ? true : undefined })}
      {note && (
        <p id={noteId} className={cn("mt-1 text-xs", error ? "text-red-600" : "text-slate-500")}>
          {note}
        </p>
      )}
    </div>
  );
}
