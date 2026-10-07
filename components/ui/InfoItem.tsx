import type { ReactNode } from "react";

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
      <Label className="text-xs uppercase text-slate-400">{label}</Label>
      <Value className={definition ? "mt-0.5 text-slate-800" : "text-slate-700"}>{value}</Value>
    </div>
  );
}
