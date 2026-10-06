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
