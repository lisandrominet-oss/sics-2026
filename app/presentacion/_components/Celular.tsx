import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconBell, IconMenu } from "@/components/icons";

// Marco de celular en CSS puro. La pantalla mide 390 px de referencia (24,375 rem), como un iPhone,
// para que los componentes reales de la app (Badge, Card, Button…) se vean con sus proporciones.
// Se dibuja como la app en celular (rediseño B): barra del marco con menú, isotipo y campana, y la hoja blanca encajada.
// Ojo: adentro no usar clases responsive (`sm:`, `lg:`): responden al ancho de la ventana, no al del celular.
export default function Celular({
  children,
  alto = "52rem",
  zoom = 1,
  className,
  style,
  conBarraApp = true,
}: {
  children: ReactNode;
  /** Alto de la pantalla; la hoja suele recortar el celular por abajo. */
  alto?: string;
  zoom?: number;
  className?: string;
  style?: CSSProperties;
  /** Barra superior de la app en móvil (menú, isotipo y campana). */
  conBarraApp?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      style={{ zoom, ...style }}
      className={cn("rounded-[3.6rem] bg-ink p-[0.7rem] shadow-pop ring-1 ring-slate-700", className)}
    >
      <div className="relative flex flex-col overflow-hidden rounded-[3rem] bg-frame" style={{ width: "24.375rem", height: alto }}>
        <div className="flex h-[2.6rem] shrink-0 items-end justify-between px-[1.8rem] pb-[0.3rem] text-[1rem] font-semibold text-slate-900">
          <span>9:41</span>
          <span className="flex items-center gap-[0.4rem]">
            <span className="h-[0.7rem] w-[1.4rem] rounded-sm bg-slate-900/90" />
            <span className="h-[0.8rem] w-[1.6rem] rounded-[0.2rem] border border-slate-900/80" />
          </span>
        </div>
        {conBarraApp && (
          <div className="flex shrink-0 items-center justify-between pb-1 pl-1 pr-1 pt-1">
            <span className="flex h-11 w-11 items-center justify-center text-slate-500">
              <IconMenu />
            </span>
            <img src="/brand/isotipo-color.svg" alt="" className="h-7 w-auto" />
            <span className="flex h-11 w-11 items-center justify-center text-slate-500">
              <IconBell />
            </span>
          </div>
        )}
        <div className="mx-2 min-h-0 flex-1 overflow-hidden rounded-t-2xl bg-sheet px-4 pb-6 pt-5">{children}</div>
      </div>
    </div>
  );
}
