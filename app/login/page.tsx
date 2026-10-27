"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconAlertTriangle, IconGoogle } from "@/components/icons";
import BrandLogoFull from "@/components/BrandLogoFull";
import Button from "@/components/ui/Button";
import { RecorridoPasos } from "@/components/ui/Recorrido";

function LoginForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("motivo") === "inactividad"
      ? "Tu sesión se cerró por 30 minutos de inactividad. Volvé a ingresar."
      : null
  );

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
    <div className="animate-enter">
      <h1 className="text-[1.375rem] font-medium tracking-tight text-slate-900">Bienvenido</h1>
      <p className="mt-2 text-sm text-slate-500">
        Ingresá con tu cuenta de Google corporativa para continuar.
      </p>
      {error && (
        <div role="alert" className="animate-shake mt-4 flex items-start gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900">
          <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="[overflow-wrap:anywhere]">{error}</p>
        </div>
      )}
      <Button variant="secondary" size="lg" onClick={signInWithGoogle} loading={loading} className="mt-6 w-full">
        <IconGoogle />
        {loading ? "Redirigiendo…" : "Ingresar con Google"}
      </Button>
    </div>
  );
}

// Una hoja sobre el marco: a la izquierda el texto de siempre y un fragmento del producto (el recorrido de una SIC,
// con datos de ejemplo fijos); a la derecha el ingreso. En celular queda una sola columna con el botón al alcance del pulgar.
export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-stretch justify-center bg-frame lg:items-center lg:p-6">
      <div className="grid w-full max-w-5xl content-start overflow-hidden bg-sheet lg:min-h-[35rem] lg:content-stretch lg:grid-cols-[1.1fr_1fr] lg:rounded-2xl lg:border lg:border-slate-200">
        <section aria-label="Servicios Industriales" className="flex flex-col justify-between gap-8 bg-sheet px-5 pt-7 lg:bg-slate-50 lg:p-10">
          <BrandLogoFull className="h-12 w-auto self-start lg:h-14" />
          <div className="animate-enter [animation-delay:120ms]">
            <p className="max-w-[21em] text-balance text-xl font-medium leading-snug tracking-tight text-slate-900 lg:text-[1.625rem]">
              Toda la gestión de compras de Servicios Industriales, de punta a punta.
            </p>
            <p className="mt-4 hidden max-w-[44ch] text-sm text-slate-500 lg:block">
              Desde el pedido de cada área hasta la recepción de mercadería en pañol, con
              aprobaciones y trazabilidad en un solo lugar.
            </p>
          </div>
          {/* Ejemplo fijo, sin datos reales: ilustra el recorrido que ve cada SIC. */}
          <div aria-hidden="true" className="hidden rounded-lg border border-slate-200 bg-sheet px-4 py-3.5 lg:block">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-slate-900">SIC-MANT-2026-0403</span>
              <span className="text-slate-500">Orden de compra emitida</span>
            </div>
            <p className="mb-3 mt-0.5 text-[13px] text-slate-500">Mangueras hidráulicas de 3/4 pulgada, 6 unidades</p>
            <RecorridoPasos status="orden_emitida" />
          </div>
        </section>

        <section className="flex flex-col justify-center px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 lg:p-12">
          <div className="w-full max-w-sm">
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </section>
      </div>
    </div>
  );
}
