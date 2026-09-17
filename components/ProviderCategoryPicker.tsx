"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string; active: boolean };

export default function ProviderCategoryPicker({
  categories,
  selected,
  onToggle,
  onCategoryCreated,
}: {
  categories: Category[];
  selected: string[];
  onToggle: (categoryId: string) => void;
  onCategoryCreated: (category: Category) => void;
}) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("provider_categories")
      .insert({ name })
      .select()
      .single();
    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    onCategoryCreated(data);
    setNewName("");
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700">Categorías / Rubros</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {categories
          .filter((c) => c.active)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selected.includes(c.id)
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {c.name}
            </button>
          ))}
        {categories.filter((c) => c.active).length === 0 && (
          <p className="text-xs text-slate-400">Todavía no hay categorías. Creá la primera acá abajo.</p>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva categoría (ej: Ferretería industrial)"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={addCategory}
          disabled={creating || !newName.trim()}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {creating ? "Creando…" : "+ Crear"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
