import { toast } from "sonner";

// Avisos de la app. Éxito/info desaparecen solos; los errores quedan hasta que el usuario los cierre.
export const notify = {
  success: (message: string, description?: string) =>
    toast.success(message, { description, duration: 4000 }),
  info: (message: string, description?: string) =>
    toast.info(message, { description, duration: 5000 }),
  warning: (message: string, description?: string) =>
    toast.warning(message, { description, duration: 6000 }),
  error: (message: string, description?: string) =>
    toast.error(message, { description, duration: Infinity }),
  // Muestra "cargando → éxito/error" para una operación async.
  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ) => toast.promise(promise, messages),
};

// Muestra el resultado de una operación de Supabase: error (persistente) o éxito. Devuelve true si salió bien.
export function reportResult(
  error: { message: string } | null | undefined,
  successMessage: string
): boolean {
  if (error) {
    notify.error("No se pudo completar la acción", error.message);
    return false;
  }
  notify.success(successMessage);
  return true;
}
