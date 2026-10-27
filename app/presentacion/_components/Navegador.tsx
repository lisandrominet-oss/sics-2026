import { cn } from "@/lib/cn";

// Ventana de navegador con una captura real de la app. La captura va embebida (ver scripts/capturas-presentacion.js).
export default function Navegador({
  src,
  alt,
  ancho,
  alto,
  className,
}: {
  src: string;
  alt: string;
  /** Medidas de la captura, para reservar el espacio exacto. */
  ancho: number;
  alto: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[1.2rem] border border-slate-300 bg-sheet shadow-pop", className)}>
      <div className="flex h-[3rem] items-center gap-[0.7rem] border-b border-slate-200 bg-slate-100 px-[1.4rem]" aria-hidden="true">
        <span className="h-[1rem] w-[1rem] rounded-full bg-slate-300" />
        <span className="h-[1rem] w-[1rem] rounded-full bg-slate-300" />
        <span className="h-[1rem] w-[1rem] rounded-full bg-slate-300" />
        <span className="ml-[1.4rem] h-[1.8rem] flex-1 rounded-full bg-sheet" />
      </div>
      <img src={src} alt={alt} width={ancho} height={alto} className="block h-auto w-full" />
    </div>
  );
}
