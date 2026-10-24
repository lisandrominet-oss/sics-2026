import Aparece from "../_components/Aparece";
import Celular from "../_components/Celular";
import Hoja from "../_components/Hoja";
import Tablero from "../_pantallas/Tablero";
import { IconCheck } from "@/components/icons";

const PUNTOS = ["Un solo lugar para todo el circuito", "Cada persona ve lo que le toca", "Una acción clara para cada responsable"];

export default function Hoja03QueEs({ total }: { total: number }) {
  return (
    <Hoja n={3} total={total} etiqueta="Qué es SICS" titulo="Cada pedido tiene su responsable">
      <ul className="space-y-[1.4rem] px-[3.2rem] pt-[2.8rem]">
        {PUNTOS.map((p, i) => (
          <Aparece as="li" key={p} retardo={100 * i} className="flex items-center gap-[1.4rem] text-[2.3rem] font-medium text-slate-800">
            <span className="flex h-[3.2rem] w-[3.2rem] shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <IconCheck className="h-[1.8rem] w-[1.8rem]" />
            </span>
            {p}
          </Aparece>
        ))}
      </ul>
      <Aparece retardo={250} className="absolute bottom-0 left-0 right-0 flex justify-center">
        <div className="translate-y-[10rem]">
          <Celular zoom={1.2} alto="34rem">
            <Tablero conTarjetas={false} />
          </Celular>
        </div>
      </Aparece>
    </Hoja>
  );
}
