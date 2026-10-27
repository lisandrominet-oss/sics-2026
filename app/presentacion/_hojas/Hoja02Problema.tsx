import Aparece from "../_components/Aparece";
import Hoja from "../_components/Hoja";

// Cifras de la situación de partida, confirmadas por Lisandro el 23/10/2026 (60–70 pedidos por mes, ~7 días en Gerencia).
// Difieren del pitch de agosto («Sistema SICs .pdf»: 30–50 y ~5 días) y no salen de la base ni del flujograma.
const DATOS = [
  { cifra: "60–70", texto: "pedidos de compra por mes" },
  { cifra: "≈ 7 días", texto: "esperando en Gerencia" },
  { cifra: "A mano", texto: "mensajes y llamados, uno por uno" },
];

export default function Hoja02Problema({ total }: { total: number }) {
  return (
    <Hoja
      n={2}
      total={total}
      etiqueta="El punto de partida"
      titulo="Hoy las compras no tienen un sistema ni trazabilidad"
      bajada="Se ejecutan de forma tradicional"
    >
      <div className="space-y-[3rem] px-[3.2rem] pt-[4rem]">
        {DATOS.map((d, i) => (
          <Aparece key={d.cifra} retardo={120 * i}>
            <div className="border-l-[0.6rem] border-brand pl-[2.4rem]">
              <p className="text-[6.2rem] font-semibold leading-none tracking-tight text-slate-900">{d.cifra}</p>
              <p className="mt-[0.8rem] text-[2.4rem] leading-snug text-slate-700">{d.texto}</p>
            </div>
          </Aparece>
        ))}
      </div>
    </Hoja>
  );
}
