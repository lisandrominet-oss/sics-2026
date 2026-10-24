import Aparece from "../_components/Aparece";
import Celular from "../_components/Celular";
import Hoja from "../_components/Hoja";
import Detalle from "../_pantallas/Detalle";
import { STATUS_LABELS, type SicStatus } from "@/lib/constants";

const PUNTOS = ["Cada uno ve el estado de lo suyo", "Quién actuó y cuándo", "Cada paso queda en el recorrido"];

// Mismos colores que StatusBadge (components/StatusBadge.tsx), en tamaño de lectura.
const ESTADOS: { estado: SicStatus; clases: string }[] = [
  { estado: "enviada", clases: "bg-slate-100 text-slate-700" },
  { estado: "cotizando", clases: "bg-amber-100 text-amber-700" },
  { estado: "aprobada", clases: "bg-emerald-100 text-emerald-700" },
  { estado: "cerrada", clases: "bg-slate-200 text-slate-600" },
];

export default function Hoja08Trazabilidad({ total }: { total: number }) {
  return (
    <Hoja n={8} total={total} etiqueta="Trazabilidad" titulo="Siempre se sabe dónde está cada pedido">
      <ul className="absolute left-[3.2rem] top-[25rem] w-[20rem] space-y-[1.8rem]">
        {PUNTOS.map((p, i) => (
          <Aparece
            as="li"
            key={p}
            retardo={100 * i}
            className="border-l-[0.5rem] border-indigo-600 pl-[1.4rem] text-[2rem] font-medium leading-snug text-slate-800"
          >
            {p}
          </Aparece>
        ))}
      </ul>
      <Aparece retardo={300} className="absolute left-[3.2rem] top-[47rem] w-[20rem]">
        <p className="text-[1.9rem] font-medium text-slate-500">14 estados posibles</p>
        <div className="mt-[1rem] flex flex-col items-start gap-[0.8rem]">
          {ESTADOS.map((s) => (
            <span
              key={s.estado}
              className={`inline-flex items-center gap-[0.7rem] whitespace-nowrap rounded-full px-[1.5rem] py-[0.6rem] text-[1.9rem] font-medium leading-none ${s.clases}`}
            >
              <span className="h-[0.9rem] w-[0.9rem] rounded-full bg-current opacity-70" aria-hidden="true" />
              {STATUS_LABELS[s.estado]}
            </span>
          ))}
        </div>
      </Aparece>
      <Aparece retardo={250} className="absolute right-[2.2rem] top-[25rem]">
        <Celular zoom={0.9} alto="46rem">
          <Detalle />
        </Celular>
      </Aparece>
    </Hoja>
  );
}
