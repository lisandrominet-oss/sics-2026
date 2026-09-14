import { STATUS_COLORS, STATUS_LABELS, type SicStatus } from "@/lib/constants";

export default function StatusBadge({ status }: { status: SicStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
