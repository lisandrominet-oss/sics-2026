import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconInbox } from "@/components/icons";

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
        "flex animate-fade-up flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? (
          <IconInbox />
        )}
      </div>
      <p className="text-balance text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-pretty text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
