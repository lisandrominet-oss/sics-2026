import Aparece from "../_components/Aparece";
import Hoja from "../_components/Hoja";

// Reglas verificadas en el código: lib/constants.ts (CAN_SEE_AMOUNTS), lib/modules.ts, middleware.ts (30 min),
// migración 20261012100000 (sic_finance).
const REGLAS = [
  { titulo: "Montos privados", texto: "Los ven Compras, Gerencia, el Administrador y el jefe del área." },
  { titulo: "Módulos a medida", texto: "Cada usuario, solo sus módulos." },
  { titulo: "Reglas en la base de datos", texto: "Se aplican en el servidor." },
  { titulo: "Ingreso controlado", texto: "Con Google y rol asignado; se cierra a los 30 min sin uso." },
];

export default function Hoja07Permisos({ total }: { total: number }) {
  return (
    <Hoja n={7} total={total} etiqueta="Gobernanza · permisos" titulo="Cada quien ve lo que le corresponde">
      <ul className="space-y-[1.4rem] px-[3.2rem] pt-[2.8rem]">
        {REGLAS.map((r, i) => (
          <Aparece
            as="li"
            key={r.titulo}
            retardo={80 * i}
            className="flex gap-[1.8rem] rounded-[1.2rem] border border-slate-200 px-[2rem] py-[1.3rem]"
          >
            <span className="flex h-[3.6rem] w-[3.6rem] shrink-0 items-center justify-center rounded-[0.9rem] bg-slate-100 text-[2rem] font-semibold text-slate-900">
              {i + 1}
            </span>
            <div>
              <p className="text-[2.2rem] font-semibold text-slate-900">{r.titulo}</p>
              <p className="mt-[0.2rem] text-[1.95rem] leading-snug text-slate-600">{r.texto}</p>
            </div>
          </Aparece>
        ))}
      </ul>
    </Hoja>
  );
}
