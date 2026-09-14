import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function getCurrentProfile(): Promise<Profile | null> {
  const fromMiddleware = headers().get("x-profile");
  if (fromMiddleware) {
    try {
      return JSON.parse(decodeURIComponent(fromMiddleware)) as Profile;
    } catch {
      // header corrupto o inesperado: seguimos con la consulta directa de abajo
    }
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return profile;
}
