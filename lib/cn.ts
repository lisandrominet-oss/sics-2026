// Une clases de Tailwind ignorando valores vacíos.
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
