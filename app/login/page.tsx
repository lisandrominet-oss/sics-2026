"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconGoogle } from "@/components/icons";
import BrandLogoFull from "@/components/BrandLogoFull";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

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
    <Card padding="none" elevated className="animate-enter p-8 text-center">
      <h1 className="text-balance text-xl font-semibold tracking-tight text-slate-900">Bienvenido</h1>
      <p className="mt-2 text-sm text-slate-500">
        Ingresá con tu cuenta de Google corporativa para continuar.
      </p>
      <Button variant="secondary" size="lg" onClick={signInWithGoogle} loading={loading} className="mt-6 w-full">
        <IconGoogle />
        {loading ? "Redirigiendo…" : "Ingresar con Google"}
      </Button>
      {error && <p role="alert" className="animate-shake mt-4 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-1/2 flex-col justify-between bg-slate-900 p-12 lg:flex">
        <img src="/brand/logo-completo-negativo.svg" alt="Servicios Industriales" className="h-16 w-auto self-start" />
        <div className="max-w-md animate-enter [animation-delay:120ms]">
          <p className="text-balance text-3xl font-semibold leading-snug tracking-tight text-white">
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
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLogoFull className="h-14 w-auto" />
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
