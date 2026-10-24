import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import StatusBadge from "@/components/StatusBadge";
import { IconArrowRight, IconPlusCircle } from "@/components/icons";
import { eyebrowClass, numClass } from "@/lib/ui";
import { SICS_ACTIVAS, TABLERO } from "../_data/sics-demo";

// Maqueta del Tablero en celular, con los mismos componentes y clases que la pantalla real (app/(app)/dashboard).
export default function Tablero({ conTarjetas = true }: { conTarjetas?: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tablero</h1>
        <span className={buttonClass()}>
          <IconPlusCircle className="h-4 w-4" />
          Nueva SIC
        </span>
      </div>

      {conTarjetas && (
        <div className="mt-4 grid grid-cols-1 gap-3">
          <Stat label="SICs totales" valor={TABLERO.totales} pie="Vista general" />
          <Stat label="Pendientes de mi acción" valor={TABLERO.pendientes} pie="Requieren revisión" acento />
          <Stat label="Cerradas" valor={TABLERO.cerradas} pie="Historial completo" />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-slate-900 px-3.5 py-1.5 font-medium text-white">Todas</span>
        <span className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium text-slate-500">
          Pendientes de mi acción
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        </span>
      </div>

      <Card padding="none" className="mt-3 overflow-hidden">
        <div className="border-b border-slate-100 px-6 pt-5">
          <p className={eyebrowClass}>Actividad</p>
          <div className="-mb-px mt-2 flex gap-6">
            <span className="flex items-center gap-2 border-b-2 border-slate-900 pb-3 text-sm font-semibold text-slate-900">
              SIC activas
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium tabular-nums text-white">{TABLERO.activas}</span>
            </span>
            <span className="flex items-center gap-2 border-b-2 border-transparent pb-3 text-sm font-semibold text-slate-500">
              Historial
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-500">{TABLERO.historial}</span>
            </span>
          </div>
        </div>
        <ul className="divide-y divide-slate-100">
          {SICS_ACTIVAS.map((sic) => (
            <li key={sic.code} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-semibold text-indigo-600">
                  {sic.prefix}
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold text-slate-900 ${numClass}`}>
                    {sic.code}
                    {sic.tipo === "cuenta_corriente" && (
                      <Badge tone="violet" size="sm" className="ml-2">
                        Cta. cte.
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{sic.asunto}</p>
                  <p className="truncate text-xs text-slate-400">{sic.area}</p>
                  <p className={`text-xs text-slate-500 ${numClass}`}>Necesaria: {sic.necesaria}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <StatusBadge status={sic.estado} />
                <span className="flex items-center gap-1 text-sm font-medium text-indigo-600">
                  Ver
                  <IconArrowRight />
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, valor, pie, acento }: { label: string; valor: number; pie: string; acento?: boolean }) {
  return (
    <Card padding="lg">
      <p className={eyebrowClass}>{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${numClass} ${acento ? "text-indigo-600" : "text-slate-900"}`}>{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{pie}</p>
    </Card>
  );
}
