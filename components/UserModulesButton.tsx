"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { inputCompactClass } from "@/lib/ui";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import { MODULES, moduleDefault, parseOverrides, type ModuleKey } from "@/lib/modules";
import type { Json } from "@/lib/database.types";

type Choice = "rol" | "si" | "no";

function toChoices(raw: Json): Record<ModuleKey, Choice> {
  const overrides = parseOverrides(raw);
  return Object.fromEntries(
    MODULES.map((m) => [m.key, overrides[m.key] === undefined ? "rol" : overrides[m.key] ? "si" : "no"])
  ) as Record<ModuleKey, Choice>;
}

// Botón + diálogo para habilitar o quitar módulos a un usuario puntual, sobre lo que ya le da su rol.
export default function UserModulesButton({
  profileId,
  fullName,
  role,
  moduleOverrides,
  disabledReason,
}: {
  profileId: string;
  fullName: string | null;
  role: UserRole | null;
  moduleOverrides: Json;
  // Si viene, el botón queda deshabilitado y lo explica (ej. uno mismo, sin rol todavía).
  disabledReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState(() => toChoices(moduleOverrides));
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setChoices(toChoices(moduleOverrides));
    setOpen(true);
  }

  async function save() {
    const overrides: Record<string, boolean> = {};
    for (const m of MODULES) {
      if (choices[m.key] !== "rol") overrides[m.key] = choices[m.key] === "si";
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("staff_set_user_modules", {
      p_profile_id: profileId,
      p_overrides: overrides,
    });
    setSaving(false);
    if (error) {
      notify.error("No se pudieron guardar los módulos", error.message);
      return;
    }
    notify.success("Módulos actualizados");
    setOpen(false);
    router.refresh();
  }

  const customCount = Object.values(parseOverrides(moduleOverrides)).length;

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={openDialog}
        disabled={!!disabledReason}
        title={disabledReason}
      >
        Módulos{customCount > 0 ? ` (${customCount})` : ""}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Módulos del usuario" className="sm:max-w-lg">
        <p className="mt-1 text-xs text-slate-500">
          {fullName || "Este usuario"}
          {role ? ` · ${ROLE_LABELS[role]}` : ""}. Por defecto cada rol tiene sus módulos; acá podés sumarle o quitarle
          alguno a esta persona.
        </p>
        <ul className="mt-4 divide-y divide-slate-100">
          {MODULES.map((m) => {
            const byRole = moduleDefault(role, m.key);
            return (
              <li key={m.key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{m.title}</p>
                  <p className="text-xs text-slate-500">{m.description}</p>
                </div>
                <select
                  aria-label={`Acceso a ${m.title}`}
                  value={choices[m.key]}
                  onChange={(e) => setChoices((c) => ({ ...c, [m.key]: e.target.value as Choice }))}
                  className={`${inputCompactClass} shrink-0`}
                >
                  <option value="rol">Por rol ({byRole ? "sí" : "no"})</option>
                  <option value="si">Habilitado</option>
                  <option value="no">Deshabilitado</option>
                </select>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Guardar
          </Button>
        </div>
      </Modal>
    </>
  );
}
