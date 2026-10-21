import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

// Postgres de Neon (DATABASE_URL = conexión con pooler). Solo servidor.
// La base operativa de SICS sigue siendo Supabase; esto es un acceso aparte.
const globalForNeon = globalThis as unknown as { neonPool?: Pool };

export function getNeonPool(): Pool {
  if (!globalForNeon.neonPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Falta DATABASE_URL (correr `neon env pull`).");
    const pool = new Pool({ connectionString });
    attachDatabasePool(pool);
    globalForNeon.neonPool = pool;
  }
  return globalForNeon.neonPool;
}
