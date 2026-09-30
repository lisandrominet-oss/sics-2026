// Estos valores son públicos por diseño (clave "publishable"/anon de Supabase);
// la seguridad real la dan las políticas de RLS en la base, no el secreto de esta clave.
// Sin valor de respaldo a propósito: este repo es la plantilla base para varias
// empresas (cada una con su propio proyecto Supabase), así que si faltan las
// variables de entorno el deploy tiene que fallar fuerte en vez de conectarse
// en silencio a la base de otra empresa.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Configurala en Vercel (Project Settings → Environment Variables) antes de desplegar.`
    );
  }
  return value;
}

export const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
