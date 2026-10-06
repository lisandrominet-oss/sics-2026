import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Props = HTMLAttributes<HTMLDivElement> & {
  /** Eleva la tarjeta al pasar el mouse (para tarjetas clicables). */
  interactive?: boolean;
};

export default function Card({ interactive = false, className, ...rest }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-soft",
        interactive &&
          "cursor-pointer transition-all duration-base ease-out-expo hover:-translate-y-0.5 hover:shadow-lift",
        className
      )}
      {...rest}
    />
  );
}
