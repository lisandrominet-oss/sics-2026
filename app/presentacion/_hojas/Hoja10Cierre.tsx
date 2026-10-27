import Aparece from "../_components/Aparece";
import Hoja from "../_components/Hoja";
import { IconCheck } from "@/components/icons";

// «Ya funciona» está verificado en el código de SICS. «Lo que viene» sale de lo pendiente documentado:
// liquidación mensual de cuenta corriente (flujograma, paso 9) y módulos en construcción (lib/modules.ts, DEMO_MODULES).
const HOY = [
  "Circuito de pedido a factura",
  "Permisos por rol y por módulo",
  "Recorrido: quién hizo qué y cuándo",
  "Contratos, Personal y Roster",
];
const PROXIMO = ["Liquidación mensual de cta. cte.", "Recursos Humanos, Logística y Administración"];

export default function Hoja10Cierre({ total }: { total: number }) {
  return (
    <Hoja n={10} total={total} etiqueta="Cierre" titulo="Hoy y lo que viene">
      <div className="px-[3.2rem] pt-[2.4rem]">
        <Aparece>
          <p className="text-[1.9rem] font-medium text-slate-500">Ya funciona</p>
          <ul className="mt-[1.2rem] space-y-[1.3rem]">
            {HOY.map((t) => (
              <li key={t} className="flex items-center gap-[1.4rem] text-[2.2rem] font-medium text-slate-800">
                <span className="flex h-[3.2rem] w-[3.2rem] shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <IconCheck className="h-[1.8rem] w-[1.8rem]" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Aparece>
        <Aparece retardo={200} className="mt-[3rem]">
          <p className="text-[1.9rem] font-medium text-slate-500">Lo que viene</p>
          <ul className="mt-[1.2rem] space-y-[1.3rem]">
            {PROXIMO.map((t) => (
              <li key={t} className="flex items-center gap-[1.4rem] text-[2.2rem] font-medium text-slate-800">
                <span className="flex h-[3.2rem] w-[3.2rem] shrink-0 items-center justify-center rounded-full bg-slate-100 text-[2rem] font-semibold text-slate-700">
                  →
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Aparece>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center bg-ink px-[3.2rem] py-[2.6rem] text-center">
        <img src="/brand/logo-completo-negativo.svg" alt="Servicios Industriales" className="h-[4.4rem] w-auto" />
        <p className="mt-[1rem] text-[1.9rem] text-slate-300">SICS 2026 · Sistema de compras</p>
      </div>
    </Hoja>
  );
}
