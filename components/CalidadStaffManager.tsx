"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { untyped } from "@/lib/calidad";

export type StaffCandidate = {
  id: string;
  name: string;
  email: string | null;
  roleLabel: string;
  isSupervisor: boolean;
  hasModule: boolean;
  isAdmin: boolean;
};

// Solo el admin: quién puede cargar avance además de él. El acceso al módulo se da desde «Usuarios».
export default function CalidadStaffManager({ people }: { people: StaffCandidate[] }) {
  const router = useRouter();
  const supabase = useMemo(() => untyped(createClient()), []);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(p: StaffCandidate) {
    setBusy(p.id);
    const { error } = await supabase.rpc("cal_set_staff", { p_user_id: p.id, p_active: !p.isSupervisor });
    setBusy(null);
    if (error) return notify.error("No se pudo actualizar", error.message);
    notify.success(p.isSupervisor ? `${p.name} ya no carga avance` : `${p.name} ahora es supervisor de Calidad`);
    router.refresh();
  }

  return (
    <Card padding="none">
      <ul className="divide-y divide-slate-100">
        {people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{p.name}</p>
              <p className="text-xs text-slate-500">{p.roleLabel}{p.email ? ` · ${p.email}` : ""}</p>
              {!p.isAdmin && !p.hasModule && (
                <p className="mt-1 text-xs text-amber-900">No tiene el módulo Calidad habilitado: activalo desde Usuarios para que pueda entrar.</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {p.isAdmin ? (
                <Badge tone="neutral" size="sm">Administrador: siempre edita</Badge>
              ) : (
                <>
                  {p.isSupervisor && <Badge tone="success" size="sm" dot>Supervisor</Badge>}
                  <Button size="sm" variant={p.isSupervisor ? "secondary" : "primary"} loading={busy === p.id} onClick={() => toggle(p)}>
                    {p.isSupervisor ? "Quitar" : "Hacer supervisor"}
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
