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

/** Clases de una tarjeta, para usarla en elementos que no son un <div> (por ejemplo un <form> o <section>). */
export function cardClass({
  padding = "md",
  elevated = false,
  className,
}: {
  padding?: keyof typeof PADDING;
  elevated?: boolean;
  className?: string;
} = {}) {
  return cn("rounded-xl border border-slate-200 bg-white", PADDING[padding], elevated && "shadow-soft", className);
}

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
        cardClass({ padding, elevated }),
        interactive &&
          "cursor-pointer transition-all duration-base ease-out-expo hover:-translate-y-0.5 hover:shadow-lift",
        className
      )}
      {...rest}
    >
      {title && <h2 className="text-balance text-sm font-semibold text-slate-900">{title}</h2>}
      {title ? <div className="mt-3">{children}</div> : children}
    </div>
  );
}
