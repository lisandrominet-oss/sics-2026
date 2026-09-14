import { STATUS_COLORS, STATUS_LABELS, type SicStatus } from "@/lib/constants";

export default function StatusBadge({ status }: { status: SicStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
