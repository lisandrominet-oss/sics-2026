import Aparece from "../_components/Aparece";
import Celular from "../_components/Celular";
import Hoja from "../_components/Hoja";
import NuevaSic from "../_pantallas/NuevaSic";

const PUNTOS = [
  "El catálogo sugiere mientras escribís",
  "Archivo de referencia y certificado de calidad por artículo",
  "Se puede editar o anular hasta que Compras la toma",
];

export default function Hoja04Pedir({ total }: { total: number }) {
  return (
    <Hoja n={4} total={total} etiqueta="Pedir" titulo="Pedir es completar un formulario" bajada="Asunto, fecha y artículos. Listo.">
      <ol className="absolute left-[3.2rem] top-[30rem] w-[20rem] space-y-[2.2rem]">
        {PUNTOS.map((p, i) => (
          <Aparece as="li" key={p} retardo={120 * i} className="flex gap-[1.2rem] text-[2rem] leading-snug text-slate-700">
            <span className="flex h-[3rem] w-[3rem] shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[1.9rem] font-semibold text-white">
              {i + 1}
            </span>
            {p}
          </Aparece>
        ))}
      </ol>
      <Aparece retardo={250} className="absolute right-[2.2rem] top-[27rem]">
        <Celular zoom={0.9} alto="48rem">
          <NuevaSic />
        </Celular>
      </Aparece>
    </Hoja>
  );
}
