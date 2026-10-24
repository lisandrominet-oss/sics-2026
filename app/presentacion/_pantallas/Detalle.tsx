import Card from "@/components/ui/Card";
import StatusBadge from "@/components/StatusBadge";
import { STATUS_LABELS } from "@/lib/constants";
import { numClass } from "@/lib/ui";
import { RECORRIDO } from "../_data/sics-demo";

// Maqueta del detalle de una SIC en celular: recorrido (app/(app)/sic/[id]/page.tsx).
export default function Detalle() {
  return (
    <div className="space-y-4">
      <div>
        <p className={`text-sm font-semibold text-slate-900 ${numClass}`}>SIC-GCIA-2026-0001</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Chapa de 2 1/2&quot;</h1>
        <div className="mt-2">
          <StatusBadge status="orden_emitida" />
        </div>
      </div>

      <Card className="text-sm">
        <h2 className="font-semibold text-slate-900">Recorrido de la SIC</h2>
        <ol className="mt-3">
          {RECORRIDO.map((ev, i) => {
            const ultimo = i === RECORRIDO.length - 1;
            return (
              <li key={i} className="relative pb-4 pl-5 last:pb-0">
                {!ultimo && <span aria-hidden="true" className="absolute -bottom-1 left-[3px] top-3 w-px bg-slate-200" />}
                <span aria-hidden="true" className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${ultimo ? "bg-indigo-600" : "bg-slate-400"}`} />
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
