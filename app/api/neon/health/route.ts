import { NextResponse } from "next/server";
import { getNeonPool } from "@/lib/neon";

export const dynamic = "force-dynamic";

// Chequeo de conectividad con Neon. El middleware exige sesión para llegar acá.
export async function GET() {
  try {
    const started = Date.now();
    const { rows } = await getNeonPool().query<{ ok: number }>("select 1 as ok");
    return NextResponse.json({ ok: rows[0]?.ok === 1, ms: Date.now() - started });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
