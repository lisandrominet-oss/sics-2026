import Aparece from "../_components/Aparece";
import Hoja from "../_components/Hoja";
import { Rol, type Carril } from "../_components/Rol";

// Los 9 pasos del flujograma oficial (docs/flujograma-sic-src/make_html.py, ROWS).
const PASOS: { titulo: string; carril: Carril; etiqueta?: string }[] = [
  { titulo: "Pedido", carril: "emisor" },
  { titulo: "Visto bueno", carril: "jefe" },
  { titulo: "Revisión", carril: "compras" },
  { titulo: "Cotización", carril: "compras" },
  { titulo: "Validación técnica", carril: "emisor", etiqueta: "Emisor o jefe" },
  { titulo: "Si supera el tope", carril: "gerencia" },
  { titulo: "Orden de compra", carril: "compras" },
  { titulo: "Recepción", carril: "panol" },
  { titulo: "Cierre con factura", carril: "compras" },
];

export default function Hoja05Circuito({ total }: { total: number }) {
  return (
    <Hoja n={5} total={total} etiqueta="El circuito" titulo="Nueve pasos, de punta a punta">
      <ol className="px-[3.2rem] pt-[2.4rem]">
        {PASOS.map((p, i) => (
          <Aparece as="li" key={p.titulo} retardo={60 * i} className="relative flex items-center justify-between gap-[1.6rem] py-[0.8rem]">
            {i < PASOS.length - 1 && (
              <span aria-hidden="true" className="absolute left-[1.8rem] top-[3.4rem] h-[3.2rem] w-[0.2rem] bg-slate-200" />
            )}
            <span className="flex items-center gap-[1.8rem]">
              <span className="relative flex h-[3.6rem] w-[3.6rem] shrink-0 items-center justify-center rounded-full bg-slate-900 text-[1.9rem] font-semibold text-white">
                {i + 1}
              </span>
              <span className="text-[2.3rem] font-semibold text-slate-900">{p.titulo}</span>
            </span>
            <Rol carril={p.carril} etiqueta={p.etiqueta} />
          </Aparece>
        ))}
      </ol>
    </Hoja>
  );
}
