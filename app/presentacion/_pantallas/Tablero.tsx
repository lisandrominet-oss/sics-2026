import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { RecorridoTira } from "@/components/ui/Recorrido";
import { IconPlusCircle } from "@/components/icons";
import { STATUS_LABELS } from "@/lib/constants";
import { numClass } from "@/lib/ui";
import { SICS_ACTIVAS, TABLERO } from "../_data/sics-demo";

// Maqueta del Tablero en celular, con los mismos componentes y clases que la pantalla real (app/(app)/dashboard):
// encabezado, aviso de lo que espera tu acción, pestañas y filas con el recorrido.
export default function Tablero({ conAviso = true }: { conAviso?: boolean }) {
  return (
    <div>
      <PageHeader
        title="Tablero"
        description={`${TABLERO.totales} solicitudes en total · ${TABLERO.cerradas} cerradas`}
        actions={
          <span className={buttonClass()}>
            <IconPlusCircle className="h-4 w-4" />
            Nueva SIC
          </span>
        }
      />

      {conAviso && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-slate-50 px-4 py-3">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full border border-ink/40 bg-brand" />
          <p className={`min-w-0 flex-1 text-sm font-semibold ${numClass}`}>{TABLERO.pendientes} solicitudes esperan tu acción.</p>
          <span className="rounded-lg bg-ink px-3 py-1 text-xs font-medium text-on-ink">Ver pendientes</span>
        </div>
      )}

      <div className="mt-5 flex gap-6 border-b border-slate-200">
        <span className="-mb-px flex items-center gap-2 border-b-2 border-ink pb-3 text-sm font-medium text-slate-900">
          SIC activas
          <span className="font-normal tabular-nums text-slate-500">{TABLERO.activas}</span>
        </span>
        <span className="-mb-px flex items-center gap-2 border-b-2 border-transparent pb-3 text-sm text-slate-500">
          Historial de SIC
          <span className="font-normal tabular-nums text-slate-500">{TABLERO.historial}</span>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 text-sm">
        <span className="flex min-h-8 items-center rounded-lg border border-slate-300 bg-slate-100 px-3 font-medium text-slate-900">Todas</span>
        <span className="flex min-h-8 items-center gap-1.5 rounded-lg border border-transparent px-3 font-medium text-slate-500">
          Pendientes de mi acción
          <span className="h-1.5 w-1.5 rounded-full border border-ink/40 bg-brand" />
        </span>
      </div>

      <ul className="mt-3">
        {SICS_ACTIVAS.map((sic) => (
          <li key={sic.code} className="relative border-b border-slate-100 px-1 py-3.5 before:absolute before:inset-y-0 before:-left-1 before:w-[3px] before:bg-brand before:content-['']">
            <div className="flex items-baseline justify-between gap-3">
              <p className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-900 ${numClass}`}>
                {sic.code}
                {sic.tipo === "cuenta_corriente" && (
                  <Badge tone="violet" size="sm">
                    Cta. cte.
                  </Badge>
                )}
              </p>
            </div>
            <p className="mt-1 text-sm text-slate-800">{sic.asunto}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{sic.area}</p>
            <p className={`text-xs text-slate-500 ${numClass}`}>Necesaria: {sic.necesaria}</p>
            <p className="mt-2 text-xs font-medium text-slate-900">Espera tu acción</p>
            <span className="mt-2 flex items-center gap-2.5">
              <RecorridoTira status={sic.estado} />
              <span className="truncate text-xs text-slate-500">{STATUS_LABELS[sic.estado]}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
