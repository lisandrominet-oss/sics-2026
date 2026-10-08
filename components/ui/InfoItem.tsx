import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { eyebrowClass, numClass } from "@/lib/ui";

// Etiqueta + valor de solo lectura (datos de una SIC, un contrato, un proveedor o un perfil).
// `definition`: usa <dt>/<dd> (para ponerlo dentro de un <dl>).
export default function InfoItem({
  label,
  value,
  definition = false,
}: {
  label: string;
  value: ReactNode;
  definition?: boolean;
}) {
  const Label = definition ? "dt" : "p";
  const Value = definition ? "dd" : "p";
  return (
    <div>
      <Label className={eyebrowClass}>{label}</Label>
      <Value className={cn(numClass, definition ? "mt-0.5 text-slate-800" : "text-slate-700")}>{value}</Value>
    </div>
  );
}
