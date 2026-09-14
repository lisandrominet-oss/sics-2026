"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IMPERSONATABLE_ROLES, ROLE_LABELS, type UserRole } from "@/lib/constants";

export default function RoleSwitcher({
  userId,
  actingAsRole,
}: {
  userId: string;
  actingAsRole: UserRole | null;
}) {
  const router = useRouter();

  async function handleChange(value: string) {
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ acting_as_role: value === "admin" ? null : (value as UserRole) })
      .eq("id", userId);
    router.refresh();
  }

  return (
    <select
      value={actingAsRole ?? "admin"}
      onChange={(e) => handleChange(e.target.value)}
      title="Modo de prueba: actuar como otro rol"
      className="w-full rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800"
    >
      <option value="admin">Ver como: Administrador</option>
      {IMPERSONATABLE_ROLES.map((r) => (
        <option key={r} value={r}>
          Ver como: {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}
