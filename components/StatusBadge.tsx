import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { STATUS_LABELS, type SicStatus } from "@/lib/constants";

// Tono de cada estado de la SIC (mismos colores que antes: gris, ámbar, rojo, verde, azul).
const STATUS_TONES: Record<SicStatus, BadgeTone> = {
  enviada: "neutral",
  en_observacion: "warning",
  pendiente_aprobacion_jefe: "warning",
  rechazada_jefe: "danger",
  rechazada_compras: "danger",
  cotizando: "warning",
  pendiente_validacion_tecnica: "warning",
  pendiente_aprobacion_gerencia: "warning",
  rechazada_gerencia: "danger",
  aprobada: "success",
  orden_emitida: "info",
  recibida: "info",
  cerrada: "muted",
  anulada: "critical",
};

export default function StatusBadge({ status }: { status: SicStatus }) {
  return (
    <Badge tone={STATUS_TONES[status]} dot>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
