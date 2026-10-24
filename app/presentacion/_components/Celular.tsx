import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconMenu } from "@/components/icons";

// Marco de celular en CSS puro. La pantalla mide 390 px de referencia (24,375 rem), como un iPhone,
// para que los componentes reales de la app (Badge, Card, Button…) se vean con sus proporciones.
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
  /** Cabecera oscura de la app en móvil (menú + logo). */
  conBarraApp?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      style={{ zoom, ...style }}
      className={cn("rounded-[3.6rem] bg-slate-900 p-[0.7rem] shadow-pop ring-1 ring-slate-700", className)}
    >
      <div className="relative overflow-hidden rounded-[3rem] bg-slate-50" style={{ width: "24.375rem", height: alto }}>
        <div className="flex h-[2.6rem] items-end justify-between bg-slate-900 px-[1.8rem] pb-[0.3rem] text-[1rem] font-semibold text-white">
          <span>9:41</span>
          <span className="flex items-center gap-[0.4rem]">
            <span className="h-[0.7rem] w-[1.4rem] rounded-sm bg-white/90" />
            <span className="h-[0.8rem] w-[1.6rem] rounded-[0.2rem] border border-white/80" />
          </span>
        </div>
        {conBarraApp && (
          <div className="flex items-center justify-between bg-slate-900 pb-2 pl-2 pr-2 pt-1">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg text-sidebar-fg">
              <IconMenu />
            </span>
            <img src="/brand/logo-completo-negativo.svg" alt="" className="h-9 w-auto" />
            <span className="h-11 w-11" />
          </div>
        )}
        <div className="px-4 pb-6 pt-5">{children}</div>
      </div>
    </div>
  );
}
