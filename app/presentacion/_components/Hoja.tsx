import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Aparece from "./Aparece";

// Una hoja A4 vertical. Medidas en rem (1 rem = 16 px a 794 px de ancho): el texto de lectura no baja de 1,9 rem,
// que en un celular de 390 px queda en ~14 px reales.
export default function Hoja({
  n,
  total,
  etiqueta,
  titulo,
  bajada,
  children,
  className,
}: {
  n: number;
  total: number;
  etiqueta: string;
  titulo: ReactNode;
  bajada?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={`hoja-${n}`} aria-label={`Hoja ${n} de ${total}: ${etiqueta}`} className={cn("hoja", className)}>
      <div className="flex items-center justify-between px-[3.2rem] pt-[2.6rem] text-[1.9rem] font-medium text-slate-500">
        <span className="flex items-center gap-[0.8rem]">
          <img src="/brand/isotipo-color.svg" alt="" className="h-[2.6rem] w-auto" />
          {etiqueta}
        </span>
        <span className="tabular-nums">
          {n} / {total}
        </span>
      </div>
      <div className="px-[3.2rem] pt-[2.6rem]">
        <Aparece>
          <h2 className="text-balance text-[4.6rem] font-semibold leading-[1.05] tracking-tight text-slate-900">{titulo}</h2>
          {bajada && <p className="mt-[1.4rem] text-pretty text-[2.1rem] leading-snug text-slate-600">{bajada}</p>}
        </Aparece>
      </div>
      {children}
    </section>
  );
}
