import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export default function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  /** Acción sugerida (por ejemplo, un botón para crear el primer registro). */
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex animate-fade-up flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" strokeLinejoin="round" />
            <path d="M3 13h5l1.5 2.5h5L16 13h5" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
