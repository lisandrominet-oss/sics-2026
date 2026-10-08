import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import { ROLE_LABELS, effectiveRole, formatDate, type UserRole } from "@/lib/constants";
import UsersTable from "@/components/UsersTable";
import ProvisioningManager from "@/components/ProvisioningManager";
import { eyebrowClass } from "@/lib/ui";
import EmptyState from "@/components/ui/EmptyState";

const ACTION_LABELS: Record<string, string> = {
  alta_acceso: "Alta de acceso",
  edicion_acceso: "Edición de acceso",
  baja_acceso: "Baja de acceso",
  edicion_usuario: "Edición de usuario",
  pausa_usuario: "Pausa de usuario",
  reactivacion_usuario: "Reactivación de usuario",
};

type ChangeSnapshot = { role?: string | null; department?: string | null; active?: boolean };

function describe(s: ChangeSnapshot | undefined) {
  if (!s) return "";
  return [s.role ? ROLE_LABELS[s.role as UserRole] ?? s.role : "sin rol", s.department || null, s.active === false ? "pausado" : null]
    .filter(Boolean)
    .join(" / ");
}

function summarizeChange(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  const d = detail as { antes?: ChangeSnapshot; despues?: ChangeSnapshot; role?: string; department?: string | null };
  if (d.antes || d.despues) return `${describe(d.antes)} → ${describe(d.despues)}`;
  return describe(d);
}

export default async function UsuariosPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const [{ data: profiles }, { data: plants }, { data: provisioning }, { data: changeLog }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("plants").select("id, name, prefix").order("name"),
    supabase.from("user_provisioning").select("*").order("created_at"),
    supabase
      .from("user_management_log")
      .select("id, action, target_email, detail, created_at, actor:profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Sistema"
        title="Usuarios"
        description="Asigná rol, área/departamento y planta a cada usuario que inició sesión."
      />
      <div className="mt-6">
        <UsersTable profiles={profiles ?? []} plants={plants ?? []} currentUserId={profile.id} />
      </div>

      <div className="mt-8">
        <ProvisioningManager entries={provisioning ?? []} plants={plants ?? []} />
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <p className={eyebrowClass}>Auditoría</p>
          <h2 className="text-base font-semibold text-slate-900">Registro de cambios de usuarios</h2>
          <p className="mt-1 text-xs text-slate-500">
            Altas, ediciones, pausas y bajas hechas por Gerencia. Solo lo ve el administrador.
          </p>
        </div>
        {(changeLog ?? []).length === 0 ? (
          <EmptyState size="sm" className="px-6 py-6 text-center" title="Todavía no hay cambios registrados." />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {(changeLog ?? []).map((entry) => {
              const actor = entry.actor as unknown as { full_name: string | null; email: string } | null;
              return (
                <li key={entry.id} className="px-6 py-3">
                  <p className="text-slate-800">
                    <span className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                    {" · "}
                    {entry.target_email ?? "-"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {actor?.full_name ?? actor?.email ?? "Sistema"} · {formatDate(entry.created_at)}
                  </p>
                  {summarizeChange(entry.detail) && (
                    <p className="mt-0.5 text-xs text-slate-400">{summarizeChange(entry.detail)}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
