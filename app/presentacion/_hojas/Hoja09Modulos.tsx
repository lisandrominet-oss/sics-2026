import Aparece from "../_components/Aparece";
import Hoja from "../_components/Hoja";
import { Rol, type Carril } from "../_components/Rol";

const MODULOS: { titulo: string; texto: string; carril: Carril }[] = [
  { titulo: "Proveedores y catálogo", texto: "Agenda por rubro y artículos que se sugieren al pedir.", carril: "compras" },
  { titulo: "Contratos", texto: "Alquileres con cuotas, vencimientos y facturas.", carril: "compras" },
  { titulo: "Personal", texto: "Padrón con altas, bajas y licencias.", carril: "gerencia" },
  { titulo: "Roster", texto: "Quién está en sitio y quién de franco, con las horas.", carril: "gerencia" },
];

export default function Hoja09Modulos({ total }: { total: number }) {
  return (
    <Hoja n={9} total={total} etiqueta="Más allá de compras" titulo="Más que compras" bajada="Los mismos permisos, para otras áreas.">
      <div className="grid grid-cols-2 gap-[1.6rem] px-[3.2rem] pt-[3rem]">
        {MODULOS.map((m, i) => (
          <Aparece key={m.titulo} retardo={90 * i}>
            <div className="h-full rounded-[1.2rem] border border-slate-200 px-[2rem] py-[2rem]">
              <Rol carril={m.carril} />
              <p className="mt-[1.4rem] text-[2.3rem] font-semibold leading-tight text-slate-900">{m.titulo}</p>
              <p className="mt-[0.6rem] text-[1.9rem] leading-snug text-slate-600">{m.texto}</p>
            </div>
          </Aparece>
        ))}
      </div>
    </Hoja>
  );
}
