// Estos valores son públicos por diseño (clave "publishable"/anon de Supabase);
// la seguridad real la dan las políticas de RLS en la base, no el secreto de esta clave.
// Sin valor de respaldo a propósito: este repo es la plantilla base para varias
// empresas (cada una con su propio proyecto Supabase), así que si faltan las
// variables de entorno el deploy tiene que fallar fuerte en vez de conectarse
// en silencio a la base de otra empresa.
// Importante: Next.js solo puede reemplazar `process.env.NEXT_PUBLIC_X` por su
// valor real en el bundle del navegador cuando aparece como acceso literal
// (`process.env.NEXT_PUBLIC_X`), analizado de forma estática en tiempo de
// build. Un acceso dinámico como `process.env[nombreVariable]` NO se puede
// reemplazar así, y en el navegador siempre da `undefined` aunque la variable
// esté bien configurada en Vercel — por eso el valor ya resuelto se pasa acá
// como parámetro, en vez de buscarlo adentro de esta función con el nombre.
function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Configurala en Vercel (Project Settings → Environment Variables) antes de desplegar.`
    );
  }
  return value;
}

export const SUPABASE_URL = requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
