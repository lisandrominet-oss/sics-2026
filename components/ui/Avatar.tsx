import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

// Cada persona tiene su tinte pálido, estable (sale del nombre). Es identidad, no dato: nunca va en gráficos ni leyendas.
// Sin violeta ni amarillo (el amarillo es de la marca).
const MATICES = [215, 150, 35, 335, 185, 10];

function hash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function avatarTone(seed: string): { className: string; style: CSSProperties } {
  const h = MATICES[hash(seed.trim().toLowerCase()) % MATICES.length];
  return {
    className:
      "bg-[hsl(var(--h)_45%_90%)] text-[hsl(var(--h)_40%_22%)] dark:bg-[hsl(var(--h)_28%_26%)] dark:text-[hsl(var(--h)_40%_88%)]",
    style: { "--h": h } as CSSProperties,
  };
}

/** Iniciales de la primera y la última palabra del nombre. */
export function iniciales(nombre: string | null) {
  const partes = (nombre ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primera = Array.from(partes[0])[0] ?? "";
  const ultima = partes.length > 1 ? Array.from(partes[partes.length - 1])[0] ?? "" : "";
  return (primera + ultima).toUpperCase() || "?";
}

export default function Avatar({ nombre, className }: { nombre: string | null; className?: string }) {
  const tone = avatarTone(nombre ?? "?");
  return (
    <span
      aria-hidden="true"
      style={tone.style}
      className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium", tone.className, className)}
    >
      {iniciales(nombre)}
    </span>
  );
}
