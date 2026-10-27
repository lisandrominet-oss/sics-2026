import Card from "@/components/ui/Card";
import StatusBadge from "@/components/StatusBadge";
import { STATUS_LABELS } from "@/lib/constants";
import { TRAMOS, tramosDe } from "@/lib/recorrido";
import { textoRecorrido } from "@/components/ui/Recorrido";
import { numClass } from "@/lib/ui";
import { RECORRIDO, SIC_TRAZABILIDAD } from "../_data/sics-demo";

// Maqueta del detalle de una SIC en celular (app/(app)/sic/[id]/page.tsx): el recorrido en cinco tramos y el historial paso a paso.
// Las barras se dibujan acá y no con RecorridoPasos: ese componente responde al ancho de la ventana (`sm:`), no al del celular.
export default function Detalle() {
  const tramos = tramosDe("cerrada");
  return (
    <div className="space-y-4">
      <div>
        <p className={`text-sm font-medium text-slate-900 ${numClass}`}>{SIC_TRAZABILIDAD.code}</p>
        <h1 className="mt-1 text-[1.375rem] font-medium leading-tight tracking-tight text-slate-900">{SIC_TRAZABILIDAD.asunto}</h1>
        <div className="mt-2">
          <StatusBadge status="cerrada" />
        </div>
      </div>

      <div>
        <ol role="list" className="grid grid-cols-5 gap-2">
          {TRAMOS.map((nombre, i) => (
            <li key={nombre}>
              <i className={`block h-1.5 rounded-sm ${tramos[i] === "hecho" ? "bg-ink" : "bg-slate-200"}`} />
              <span className="sr-only">{nombre}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-slate-500">{textoRecorrido("cerrada")}</p>
      </div>

      <Card className="text-sm">
        <h2 className="font-semibold text-slate-900">Recorrido de la SIC</h2>
        <ol className="mt-3">
          {RECORRIDO.map((ev, i) => {
            const ultimo = i === RECORRIDO.length - 1;
            return (
              <li key={i} className="relative pb-4 pl-5 last:pb-0">
                {!ultimo && <span aria-hidden="true" className="absolute -bottom-1 left-[3px] top-3 w-px bg-slate-200" />}
                <span aria-hidden="true" className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${ultimo ? "bg-ink" : "bg-slate-400"}`} />
                <p className="font-medium text-slate-800">{STATUS_LABELS[ev.estado]}</p>
                <p className="text-xs text-slate-500">
                  {ev.rol} · <span className={numClass}>{ev.cuando}</span>
                </p>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
