import { cn } from "@/lib/cn";
import { TRAMOS, recorridoDe, tramosDe, type EstadoTramo } from "@/lib/recorrido";
import type { SicStatus } from "@/lib/constants";

// El recorrido de una SIC en cinco tramos (Emisor, Jefe de área, Compras, Gerencia, Pañol). Es el elemento propio de SICS:
// hechos en tinta, el tramo actual en el amarillo de la marca, lo que falta en gris, un rechazo en rojo.
const TEXTO_ESTADO: Record<EstadoTramo, string> = { hecho: "hecho", ahora: "en curso", falta: "pendiente", rechazado: "rechazado" };

const BARRA: Record<EstadoTramo, string> = {
  hecho: "bg-ink",
  ahora: "bg-brand border-ink/40 dark:border-brand",
  falta: "bg-slate-200",
  rechazado: "bg-red-500",
};

function textoDe(status: SicStatus) {
  const { tramo, fin } = recorridoDe(status);
  if (fin === "cerrada") return "Recorrido completo: cerrada";
  if (fin === "anulada") return "Recorrido detenido: anulada";
  if (fin === "rechazada") return `Recorrido detenido: rechazada en ${TRAMOS[tramo]}`;
  return `Ahora en ${TRAMOS[tramo]}`;
}

/** Tira compacta de 5 segmentos para listas y filas. */
export function RecorridoTira({ status, className }: { status: SicStatus; className?: string }) {
  return (
    <span role="img" aria-label={textoDe(status)} className={cn("inline-flex shrink-0 gap-[3px]", className)}>
      {tramosDe(status).map((e, i) => (
        <i key={i} className={cn("block h-1.5 w-4 rounded-sm border border-transparent", BARRA[e])} />
      ))}
    </span>
  );
}

/** Recorrido con rótulos (cabecera del detalle). `detalle` suma una línea gris bajo un tramo (quién y cuándo). */
export function RecorridoPasos({
  status,
  detalle,
  className,
}: {
  status: SicStatus;
  detalle?: Partial<Record<number, string>>;
  className?: string;
}) {
  const estados = tramosDe(status);
  return (
    // role="list": Safari/VoiceOver pierden la semántica de lista cuando Tailwind quita las viñetas.
    <ol role="list" aria-label="Recorrido de la SIC" className={cn("grid grid-cols-5 gap-2", className)}>
      {TRAMOS.map((nombre, i) => (
        <li key={nombre} aria-current={estados[i] === "ahora" ? "step" : undefined} className="min-w-0">
          <i aria-hidden="true" className={cn("block h-1.5 rounded-sm border border-transparent", BARRA[estados[i]])} />
          {/* Lo que oye un lector de pantalla: el tramo y su estado (el color solo no alcanza). */}
          <span className="sr-only">{`${nombre}: ${TEXTO_ESTADO[estados[i]]}`}</span>
          {/* En celular solo se ve la barra: el tramo actual se dice aparte, en una línea, con `textoRecorrido`. */}
          <span
            aria-hidden="true"
            className={cn(
              "mt-2 hidden truncate text-[13px] sm:block",
              estados[i] === "ahora" || estados[i] === "rechazado" ? "font-semibold text-slate-900" : estados[i] === "falta" ? "text-slate-500" : "font-medium text-slate-900"
            )}
          >
            {nombre}
          </span>
          {detalle?.[i] && <span className="hidden truncate text-xs text-slate-500 sm:block">{detalle[i]}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Frase corta para el celular o lectores de pantalla: dónde está la SIC ahora. */
export function textoRecorrido(status: SicStatus) {
  return textoDe(status);
}
