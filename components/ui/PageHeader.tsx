import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { eyebrowClass } from "@/lib/ui";
import InfoTip from "./InfoTip";

// Encabezado de página: etiqueta opcional + título + descripción, y acciones a la derecha.
// `description` es para datos (conteos, "Pedida por…"), no para explicar la pantalla: una aclaración va en `info`, detrás del ícono (i).
export default function PageHeader({
  title,
  eyebrow,
  description,
  info,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  info?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className={cn(eyebrowClass, "[overflow-wrap:anywhere]")}>{eyebrow}</p>}
        <div className={cn("flex items-center gap-2", !!eyebrow && "mt-1")}>
          <h1 className="text-balance text-[1.375rem] font-medium leading-tight tracking-tight text-slate-900 [overflow-wrap:anywhere]">
            {title}
          </h1>
          {info && <InfoTip>{info}</InfoTip>}
        </div>
        {description && <p className="mt-1.5 text-pretty text-sm text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
