"use client";

import { inputClass, labelClass } from "@/lib/ui";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify, reportResult } from "@/lib/notify";
import Button from "@/components/ui/Button";
import Card, { cardClass } from "@/components/ui/Card";

type CatalogItem = {
  id: string;
  name: string;
  active: boolean;
  uses_count: number;
  last_used_at: string | null;
};

// Igual que catalog_norm() en la base: minúsculas y sin acentos.
function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function CatalogManager({ items }: { items: CatalogItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const words = norm(search).split(" ").filter(Boolean);
    if (words.length === 0) return items;
    return items.filter((it) => {
      const key = norm(it.name);
      return words.every((w) => key.includes(w));
    });
  }, [items, search]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("catalog_save", { p_id: null as unknown as string, p_name: newName });
    setAdding(false);
    if (error) {
      notify.error("No se pudo agregar el artículo", error.message);
      return;
    }
    setNewName("");
    notify.success("Artículo agregado al catálogo");
    router.refresh();
  }

  function startEdit(it: CatalogItem) {
    setEditingId(it.id);
    setEditName(it.name);
  }

  async function saveEdit(it: CatalogItem) {
    if (editName.trim() === it.name) {
      setEditingId(null);
      return;
    }
    setSavingId(it.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("catalog_save", { p_id: it.id, p_name: editName });
    setSavingId(null);
    if (error) {
      notify.error("No se pudo renombrar el artículo", error.message);
      return;
    }
    setEditingId(null);
    notify.success("Artículo renombrado");
    router.refresh();
  }

  async function toggleActive(it: CatalogItem) {
    setSavingId(it.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("catalog_set_active", { p_id: it.id, p_active: !it.active });
    setSavingId(null);
    reportResult(error, it.active ? "Artículo desactivado: ya no se sugiere" : "Artículo reactivado");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addItem} className={cardClass({ className: "space-y-3" })}>
        <h2 className="text-sm font-semibold text-slate-900">Agregar artículo</h2>
        <div>
          <label className={labelClass}>Nombre</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            maxLength={200}
            placeholder='Ej: Disco de corte 4"'
            className={inputClass}
          />
        </div>
        <Button type="submit" loading={adding}>
          Agregar
        </Button>
      </form>

      <div>
        <label className={labelClass}>Buscar en el catálogo</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Escribí parte del nombre"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-400">
          {filtered.length} de {items.length} artículos
        </p>
      </div>

      <Card padding="none" className="overflow-x-auto">
        <table className="tabla-fija-1 w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Artículo</th>
              <th className="px-4 py-3 font-medium">Veces pedido</th>
              <th className="px-4 py-3 font-medium">Último pedido</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((it) => (
              <tr key={it.id} className={it.active ? undefined : "opacity-60"}>
                <td className="px-4 py-3 text-slate-700 [overflow-wrap:anywhere]">
                  {editingId === it.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(it);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      maxLength={200}
                      autoFocus
                      className={inputClass}
                    />
                  ) : (
                    <>
                      {it.name}
                      {!it.active && <span className="ml-2 text-xs text-slate-400">(desactivado)</span>}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{it.uses_count}</td>
                <td className="px-4 py-3 tabular-nums">{formatDate(it.last_used_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {editingId === it.id ? (
                      <>
                        <Button size="sm" loading={savingId === it.id} onClick={() => saveEdit(it)}>
                          Guardar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(it)}>
                          Renombrar
                        </Button>
                        <Button variant="ghost" size="sm" loading={savingId === it.id} onClick={() => toggleActive(it)}>
                          {it.active ? "Desactivar" : "Activar"}
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {items.length === 0 ? "Todavía no hay artículos en el catálogo." : "Ningún artículo coincide con la búsqueda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
