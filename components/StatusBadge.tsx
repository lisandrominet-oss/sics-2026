import { STATUS_COLORS, STATUS_LABELS, type SicStatus } from "@/lib/constants";

export default function StatusBadge({ status }: { status: SicStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-base ${STATUS_COLORS[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
