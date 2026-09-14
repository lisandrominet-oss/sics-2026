"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconGoogle } from "@/components/icons";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-slate-900 p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-base font-bold text-white">
            SC
          </div>
          <span className="text-lg font-semibold text-white">Sistema de Compras</span>
        </div>
        <div className="max-w-md">
          <p className="text-3xl font-bold leading-snug text-white">
            Toda la gestión de compras de Servicios Industriales, de punta a punta.
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Desde el pedido de cada área hasta la recepción de mercadería en pañol, con
            aprobaciones y trazabilidad en un solo lugar.
          </p>
        </div>
        <p className="text-xs text-slate-500">Servicios Industriales</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
              SC
            </div>
            <span className="text-sm font-semibold text-slate-900">Sistema de Compras</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">Bienvenido</h1>
            <p className="mt-2 text-sm text-slate-500">
              Ingresá con tu cuenta de Google corporativa para continuar.
            </p>
            <button
              onClick={signInWithGoogle}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <IconGoogle />
              {loading ? "Redirigiendo…" : "Ingresar con Google"}
            </button>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
