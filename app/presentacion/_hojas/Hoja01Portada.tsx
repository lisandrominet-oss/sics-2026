import Aparece from "../_components/Aparece";
import Celular from "../_components/Celular";
import Tablero from "../_pantallas/Tablero";

export default function Hoja01Portada({ total }: { total: number }) {
  return (
    <section id="hoja-1" aria-label={`Hoja 1 de ${total}: portada`} className="hoja">
      <div className="absolute -right-[12rem] top-[22rem] h-[44rem] w-[44rem] rounded-full bg-frame" aria-hidden="true" />
      <div className="relative px-[3.2rem] pt-[3.4rem]">
        <img src="/brand/logo-completo-color.svg" alt="Servicios Industriales" className="h-[4.6rem] w-auto" />
        <Aparece className="mt-[3.4rem]">
          <p className="text-[2.1rem] font-medium text-slate-500">Presentación · Octubre 2026</p>
          <h1 className="mt-[0.6rem] text-[10rem] font-semibold leading-[0.95] tracking-tight text-slate-900">SICS</h1>
          <p className="mt-[1.6rem] max-w-[44rem] text-balance text-[2.6rem] font-medium leading-tight text-slate-700">
            El sistema de compras de Servicios Industriales.
          </p>
        </Aparece>
      </div>
      <Aparece retardo={150} className="absolute bottom-0 left-0 right-0 flex justify-center">
        <div className="translate-y-[13.5rem]">
          <Celular zoom={1.3} alto="36rem">
            <Tablero />
          </Celular>
        </div>
      </Aparece>
    </section>
  );
}
