"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconLogout } from "@/components/icons";

export default function SignOutButton({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className={`flex items-center gap-2 text-sm font-medium ${
        variant === "dark"
          ? "text-slate-400 hover:text-white"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      <IconLogout className="h-4 w-4" />
      Cerrar sesión
    </button>
  );
}
