import Aparece from "../_components/Aparece";
import Celular from "../_components/Celular";
import Hoja from "../_components/Hoja";
import Navegador from "../_components/Navegador";
import Detalle from "../_pantallas/Detalle";
import { detalle } from "../_data/capturas";

const PUNTOS = ["Cada uno ve el estado de lo suyo", "Quién actuó y cuándo", "Cada paso queda en el recorrido"];

export default function Hoja08Trazabilidad({ total }: { total: number }) {
  return (
    <Hoja n={8} total={total} etiqueta="Trazabilidad" titulo="Se sabe dónde está cada pedido">
      <Aparece retardo={150} className="absolute left-[3.2rem] top-[19.5rem] w-[43.2rem]">
        <Navegador
          src={detalle}
          alt="Detalle de una SIC cerrada con su recorrido paso a paso, de Enviada a Cerrada"
          ancho={1360}
          alto={700}
        />
      </Aparece>
      <ul className="absolute left-[3.2rem] top-[48rem] w-[20rem] space-y-[1.6rem]">
        {PUNTOS.map((p, i) => (
          <Aparece
            as="li"
            key={p}
            retardo={100 * i}
            className="border-l-[0.5rem] border-brand pl-[1.4rem] text-[2rem] font-medium leading-snug text-slate-800"
          >
            {p}
          </Aparece>
        ))}
      </ul>
      <Aparece retardo={350} className="absolute right-[2.2rem] top-[45.8rem]">
        <Celular zoom={0.8} alto="40rem">
          <Detalle />
        </Celular>
      </Aparece>
    </Hoja>
  );
}
