"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";
import { IconAlertTriangle } from "@/components/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div
        role="alert"
        className="w-full max-w-lg animate-scale-in rounded-xl border border-red-200 bg-white p-6 text-center shadow-soft"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
          <IconAlertTriangle />
        </div>
        <p className="mt-4 text-xs font-medium text-red-600">Ocurrió un error</p>
        <p className="mt-2 text-sm text-slate-700">
          Algo salió mal al cargar esta pantalla. Probá de nuevo; si el problema sigue, avisale a Compras o al administrador.
        </p>
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-center text-xs text-slate-500 hover:text-slate-700">
            Ver detalle técnico
          </summary>
          <p className="mt-2 break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{error.message}</p>
          {error.digest && <p className="mt-2 text-xs text-slate-400">Código: {error.digest}</p>}
        </details>
        <Button onClick={() => reset()} className="mt-5">
          Reintentar
        </Button>
      </div>
    </div>
  );
}
