import Aparece from "../_components/Aparece";
import Hoja from "../_components/Hoja";
import { Rol, type Carril } from "../_components/Rol";

// Roles de lib/constants.ts (ROLE_LABELS) y qué hace cada uno según el flujograma.
const ROLES: { carril: Carril; texto: string }[] = [
  { carril: "emisor", texto: "Pide lo que necesita" },
  { carril: "jefe", texto: "Aprueba lo de su área" },
  { carril: "compras", texto: "Cotiza y compra" },
  { carril: "gerencia", texto: "Aprueba si se supera el tope" },
  { carril: "panol", texto: "Recibe la mercadería" },
  { carril: "admin", texto: "Configura el sistema" },
];

// Mismos tonos que los Badge de tipo de compra de la app (components/SicsList.tsx).
const TIPOS = [
  { clases: "bg-slate-100 text-slate-700", nombre: "Normal", texto: "Con cotización" },
  { clases: "bg-sky-100 text-sky-700", nombre: "Directa", texto: "Sin cotización" },
  { clases: "bg-violet-100 text-violet-700", nombre: "Cta. cte.", texto: "Proveedor habilitado" },
];

export default function Hoja06Roles({ total }: { total: number }) {
  return (
    <Hoja n={6} total={total} etiqueta="Gobernanza · roles" titulo="Cada rol tiene su parte">
      <ul className="px-[3.2rem] pt-[2rem]">
        {ROLES.map((r, i) => (
          <Aparece
            as="li"
            key={r.carril}
            retardo={60 * i}
            className="flex items-center gap-[2rem] border-b border-slate-100 py-[0.9rem] last:border-b-0"
          >
            <Rol carril={r.carril} className="w-[17rem] shrink-0" etiqueta={r.carril === "emisor" ? "Operativo" : undefined} />
            <span className="text-[2.1rem] leading-tight text-slate-700">{r.texto}</span>
          </Aparece>
        ))}
      </ul>
      <Aparece retardo={400} className="mx-[3.2rem] mt-[2.2rem]">
        <p className="text-[1.9rem] font-medium text-slate-500">Tres formas de comprar</p>
        <div className="mt-[1rem] grid grid-cols-3 gap-[1.2rem]">
          {TIPOS.map((t) => (
            <div key={t.nombre} className="rounded-[1.2rem] border border-slate-200 px-[1.6rem] py-[1.4rem]">
              <span className={`inline-block whitespace-nowrap rounded-full px-[1.3rem] py-[0.5rem] text-[1.9rem] font-semibold leading-none ${t.clases}`}>
                {t.nombre}
              </span>
              <p className="mt-[1rem] text-[1.9rem] leading-snug text-slate-700">{t.texto}</p>
            </div>
          ))}
        </div>
      </Aparece>
    </Hoja>
  );
}
