"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProviderCategoryPicker from "@/components/ProviderCategoryPicker";
import ProviderRow from "@/components/ProviderRow";
import type { Database } from "@/lib/database.types";

type Provider = Database["public"]["Tables"]["providers"]["Row"];
type Category = { id: string; name: string; active: boolean };
type CategoryLink = { provider_id: string; category_id: string };
type Comment = {
  id: string;
  provider_id: string;
  author_id: string | null;
  comment: string;
  created_at: string;
  author: { full_name: string | null } | null;
};
type ProviderFile = {
  id: string;
  provider_id: string;
  storage_path: string;
  file_name: string;
  created_at: string;
  url: string | null;
};

export default function ProvidersManager({
  categories: initialCategories,
  providers,
  categoryLinks,
  comments,
  files,
  currentUserId,
}: {
  categories: Category[];
  providers: Provider[];
  categoryLinks: CategoryLink[];
  comments: Comment[];
  files: ProviderFile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCategoriesManager, setShowCategoriesManager] = useState(false);

  function addCategoryToState(category: Category) {
    setCategories((prev) => [...prev, category]);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return providers
      .filter((p) => (showArchived ? true : p.active))
      .filter((p) => {
        if (!activeCategoryId) return true;
        return categoryLinks.some((l) => l.provider_id === p.id && l.category_id === activeCategoryId);
      })
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.contact_name ?? "").toLowerCase().includes(q) ||
          (p.email ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  }, [providers, categoryLinks, activeCategoryId, query, showArchived]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, contacto o mail…"
            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setActiveCategoryId(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              activeCategoryId === null
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Todas
          </button>
          {categories
            .filter((c) => c.active)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategoryId(c.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  activeCategoryId === c.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {c.name}
              </button>
            ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCategoriesManager((v) => !v)}
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Categorías
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            {showAddForm ? "Cancelar" : "+ Agregar proveedor"}
          </button>
        </div>
      </div>

      {showCategoriesManager && (
        <CategoriesManager categories={categories} onCategoryCreated={addCategoryToState} />
      )}

      {showAddForm && (
        <AddProviderForm
          categories={categories}
          currentUserId={currentUserId}
          onCategoryCreated={addCategoryToState}
          onDone={() => {
            setShowAddForm(false);
            router.refresh();
          }}
        />
      )}

      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Mostrar archivados
      </label>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No hay proveedores para mostrar.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <ProviderRow
                key={p.id}
                provider={p}
                categories={categories}
                categoryIds={categoryLinks.filter((l) => l.provider_id === p.id).map((l) => l.category_id)}
                comments={comments.filter((c) => c.provider_id === p.id)}
                files={files.filter((f) => f.provider_id === p.id)}
                currentUserId={currentUserId}
                onCategoryCreated={addCategoryToState}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddProviderForm({
  categories,
  currentUserId,
  onCategoryCreated,
  onDone,
}: {
  categories: Category[];
  currentUserId: string;
  onCategoryCreated: (category: Category) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [taxStatus, setTaxStatus] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: provider, error: insertError } = await supabase
      .from("providers")
      .insert({
        name: name.trim(),
        contact_name: contactName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        tax_id: taxId.trim() || null,
        tax_status: taxStatus.trim() || null,
        payment_terms: paymentTerms.trim() || null,
        favorite,
        created_by: currentUserId,
      })
      .select()
      .single();

    if (insertError || !provider) {
      setLoading(false);
      setError(insertError?.message ?? "No se pudo crear el proveedor");
      return;
    }

    if (selectedCategoryIds.length > 0) {
      await supabase
        .from("provider_category_links")
        .insert(selectedCategoryIds.map((category_id) => ({ provider_id: provider.id, category_id })));
    }

    setLoading(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Nuevo proveedor</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Nombre / Razón social</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Contacto</label>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Nombre de quien atiende"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Teléfono</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">CUIT</label>
          <input
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Condición ante IVA</label>
          <input
            value={taxStatus}
            onChange={(e) => setTaxStatus(e.target.value)}
            placeholder="Ej: Responsable Inscripto"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-700">Forma de pago</label>
          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="Ej: Cta. cte. 30 días, Contado"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <ProviderCategoryPicker
        categories={categories}
        selected={selectedCategoryIds}
        onToggle={toggleCategory}
        onCategoryCreated={(c) => {
          onCategoryCreated(c);
          setSelectedCategoryIds((prev) => [...prev, c.id]);
        }}
      />

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        Marcar como proveedor favorito
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "Guardando…" : "Guardar proveedor"}
      </button>
    </form>
  );
}

function CategoriesManager({
  categories,
  onCategoryCreated,
}: {
  categories: Category[];
  onCategoryCreated: (category: Category) => void;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.from("provider_categories").insert({ name }).select().single();
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onCategoryCreated(data);
    setNewName("");
    router.refresh();
  }

  async function toggleActive(category: Category) {
    const supabase = createClient();
    await supabase.from("provider_categories").update({ active: !category.active }).eq("id", category.id);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Categorías de proveedores</h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
            <span className={c.active ? "text-slate-700" : "text-slate-400"}>{c.name}</span>
            <button
              onClick={() => toggleActive(c)}
              className="text-xs font-medium text-slate-600 underline"
            >
              {c.active ? "Desactivar" : "Activar"}
            </button>
          </li>
        ))}
        {categories.length === 0 && <p className="py-2 text-sm text-slate-400">Sin categorías todavía.</p>}
      </ul>
      <form onSubmit={addCategory} className="mt-3 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva categoría"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Agregar
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
