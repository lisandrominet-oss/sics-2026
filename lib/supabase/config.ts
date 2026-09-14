// Estos valores son públicos por diseño (clave "publishable"/anon de Supabase);
// la seguridad real la dan las políticas de RLS en la base, no el secreto de esta clave.
// Se usa un valor de respaldo para que el deploy funcione sin depender de configurar
// variables de entorno en el dashboard de Vercel.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tzwduipcmtulcutijjxc.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_0LC31-SYIVbpqtm0JH70Vw_zCWQB11V";
