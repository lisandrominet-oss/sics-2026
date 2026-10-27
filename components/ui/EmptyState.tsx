import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export default function EmptyState({
  title,
  description,
  action,
  icon,
  size = "md",
  className,
}: {
  title: string;
  description?: string;
  /** Acción sugerida (por ejemplo, un botón para crear el primer registro). */
  action?: ReactNode;
  icon?: ReactNode;
  /** `sm`: línea simple para subsecciones (archivos, comentarios, facturas) donde una caja grande sobra. */
  size?: "sm" | "md";
  className?: string;
}) {
  if (size === "sm") {
    return (
      <div className={className}>
        <p className="text-sm text-slate-500">{title}</p>
        {description && <p className="mt-0.5 text-pretty text-xs text-slate-500">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex animate-fade-up flex-col items-start px-6 py-10 text-left",
        className
      )}
    >
      {icon && <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">{icon}</div>}
      <p className="text-balance text-base font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-[52ch] text-pretty text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
