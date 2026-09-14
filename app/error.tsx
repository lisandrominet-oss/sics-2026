"use client";

import { useEffect } from "react";

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
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-500">
          Ocurrió un error
        </p>
        <p className="mt-3 text-sm text-slate-700 break-words">{error.message}</p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-400">Código: {error.digest}</p>
        )}
        <button
          onClick={() => reset()}
          className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
