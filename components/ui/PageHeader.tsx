import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { eyebrowClass } from "@/lib/ui";

// Encabezado de página: etiqueta opcional + título + descripción, y acciones a la derecha.
export default function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className={eyebrowClass}>{eyebrow}</p>}
        <h1 className={cn("text-balance text-2xl font-semibold tracking-tight text-slate-900", !!eyebrow && "mt-1")}>
          {title}
        </h1>
        {description && <p className="mt-2 text-pretty text-sm text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
