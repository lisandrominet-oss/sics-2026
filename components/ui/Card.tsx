import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  /** Relleno interior. `none` para tarjetas que contienen tablas o listas a ras del borde. */
  padding?: "none" | "md" | "lg";
  /** Sombra suave (tarjetas destacadas, como los totales del Tablero). */
  elevated?: boolean;
  /** Eleva la tarjeta al pasar el mouse (para tarjetas clicables). */
  interactive?: boolean;
  /** Título opcional de la sección. */
  title?: ReactNode;
};

const PADDING = { none: "", md: "p-5", lg: "p-6" } as const;

export default function Card({
  padding = "md",
  elevated = false,
  interactive = false,
  title,
  className,
  children,
  ...rest
}: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white",
        PADDING[padding],
        elevated && "shadow-soft",
        interactive &&
          "cursor-pointer transition-all duration-base ease-out-expo hover:-translate-y-0.5 hover:shadow-lift",
        className
      )}
      {...rest}
    >
      {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
      {title ? <div className="mt-3">{children}</div> : children}
    </div>
  );
}
