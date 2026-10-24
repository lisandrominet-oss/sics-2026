import Aparece from "../_components/Aparece";
import Celular from "../_components/Celular";
import Hoja from "../_components/Hoja";
import Navegador from "../_components/Navegador";
import Tablero from "../_pantallas/Tablero";
import { tablero } from "../_data/capturas";
import { IconCheck } from "@/components/icons";

const PUNTOS = ["Un solo lugar para todo el circuito", "Cada persona ve lo que le toca", "Una acción clara por responsable"];

export default function Hoja03QueEs({ total }: { total: number }) {
  return (
    <Hoja n={3} total={total} etiqueta="Qué es SICS" titulo="Cada pedido tiene su responsable">
      <ul className="space-y-[1.2rem] px-[3.2rem] pt-[2.4rem]">
        {PUNTOS.map((p, i) => (
          <Aparece as="li" key={p} retardo={100 * i} className="flex items-center gap-[1.4rem] text-[2.1rem] font-medium text-slate-800">
            <span className="flex h-[3rem] w-[3rem] shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <IconCheck className="h-[1.7rem] w-[1.7rem]" />
            </span>
            {p}
          </Aparece>
        ))}
      </ul>
      <Aparece retardo={250} className="absolute left-[3.2rem] top-[35rem] w-[43.2rem]">
        <Navegador src={tablero} alt="Tablero de SICS en una computadora: totales, filtros y listado de solicitudes" ancho={1360} alto={600} />
      </Aparece>
      <Aparece retardo={400} className="absolute right-[2.2rem] top-[56.5rem]">
        <Celular zoom={0.8} alto="40rem">
          <Tablero conTarjetas={false} />
        </Celular>
      </Aparece>
      <p className="absolute left-[3.2rem] top-[60.5rem] w-[22rem] text-[2.1rem] font-medium leading-snug text-slate-500">
        En compu o celular, el mismo sistema.
      </p>
    </Hoja>
  );
}
