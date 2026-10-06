"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div
        role="alert"
        className="w-full max-w-lg animate-scale-in rounded-2xl border border-red-200 bg-white p-6 text-center shadow-soft"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 9v4m0 4h.01M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-red-500">Ocurrió un error</p>
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
