import Aparece from "../_components/Aparece";
import Hoja from "../_components/Hoja";
import Navegador from "../_components/Navegador";
import { nuevaSic } from "../_data/capturas";

const PUNTOS = [
  "El catálogo sugiere mientras escribís",
  "Archivo de referencia y certificado de calidad por artículo",
  "Se puede editar o anular hasta que Compras la toma",
];

export default function Hoja04Pedir({ total }: { total: number }) {
  return (
    <Hoja n={4} total={total} etiqueta="Pedir" titulo="Pedir es completar un formulario" bajada="Asunto, fecha y artículos. Listo.">
      <Aparece retardo={150} className="absolute left-[3.2rem] top-[22.8rem] w-[43.2rem]">
        <Navegador src={nuevaSic} alt="Formulario de Nueva SIC con un artículo y las sugerencias del catálogo" ancho={1360} alto={700} />
      </Aparece>
      <ol className="absolute left-[3.2rem] top-[50rem] w-[43.2rem] space-y-[1.4rem]">
        {PUNTOS.map((p, i) => (
          <Aparece as="li" key={p} retardo={120 * i} className="flex items-center gap-[1.4rem] text-[2.1rem] leading-snug text-slate-700">
            <span className="flex h-[3rem] w-[3rem] shrink-0 items-center justify-center rounded-full bg-ink text-[1.9rem] font-semibold text-on-ink">
              {i + 1}
            </span>
            {p}
          </Aparece>
        ))}
      </ol>
    </Hoja>
  );
}
