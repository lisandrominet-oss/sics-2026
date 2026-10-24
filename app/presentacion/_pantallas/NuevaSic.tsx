import Button from "@/components/ui/Button";
import { IconUpload } from "@/components/icons";
import { eyebrowClass, inputClass, labelClass } from "@/lib/ui";
import { ARTICULO_NUEVA_SIC as D } from "../_data/sics-demo";

const campo = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

// Maqueta de «Nueva SIC» en celular (components/NuevaSicForm.tsx + ItemsEditor.tsx).
export default function NuevaSic() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nueva SIC</h1>
      <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <p className="block text-sm font-medium text-slate-700">Área</p>
          <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{D.area}</p>
        </div>
        <div>
          <p className="block text-sm font-medium text-slate-700">Asunto / razón de la compra</p>
          <p className={campo}>{D.asunto}</p>
        </div>
        <div>
          <p className="block text-sm font-medium text-slate-700">Fecha límite</p>
          <p className={`${campo} tabular-nums`}>{D.fecha}</p>
        </div>
        <div>
          <p className="block text-sm font-medium text-slate-700">Artículos solicitados</p>
          <div className="mt-2 rounded-lg border border-slate-200 p-4">
            <span className={eyebrowClass}>Artículo 1</span>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <p className={labelClass}>Artículo</p>
                <p className={`${inputClass} bg-white`}>{D.articulo}</p>
              </div>
              <div>
                <p className={labelClass}>Cantidad</p>
                <p className={`${inputClass} bg-white tabular-nums`}>{D.cantidad}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-700">
              <span className="h-4 w-4 rounded border border-slate-300 bg-white" />
              Requiere certificado de calidad
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
              <IconUpload className="h-4 w-4" />
              Archivo de referencia (opcional)
            </div>
          </div>
        </div>
        <Button size="lg" className="w-full">
          Enviar solicitud
        </Button>
      </div>
    </div>
  );
}
