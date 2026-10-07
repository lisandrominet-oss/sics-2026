"use client";

import { inputClass, labelClass } from "@/lib/ui";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import Card, { cardClass } from "@/components/ui/Card";
import { notify, reportResult } from "@/lib/notify";
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
          <Button variant="secondary" onClick={() => setShowCategoriesManager((v) => !v)}>
            Categorías
          </Button>
          <Button onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "Cancelar" : "+ Agregar proveedor"}
          </Button>
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
            notify.success("Proveedor agregado");
            router.refresh();
          }}
        />
      )}

      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Mostrar archivados
      </label>

      <Card padding="none" className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="No hay proveedores para mostrar" description="Probá con otro filtro o agregá un proveedor nuevo." className="!border-0" />
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
      </Card>
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
  const [hasCurrentAccount, setHasCurrentAccount] = useState(false);
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
        has_current_account: hasCurrentAccount,
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
    <form onSubmit={handleSubmit} className={cardClass({ className: "space-y-3" })}>
      <h2 className="text-sm font-semibold text-slate-900">Nuevo proveedor</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Nombre / Razón social</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Contacto</label>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Nombre de quien atiende"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Teléfono</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>CUIT</label>
          <input
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Condición ante IVA</label>
          <input
            value={taxStatus}
            onChange={(e) => setTaxStatus(e.target.value)}
            placeholder="Ej: Responsable Inscripto"
            className={inputClass}
          />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Forma de pago</label>
          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="Ej: Cta. cte. 30 días, Contado"
            className={inputClass}
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
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={hasCurrentAccount} onChange={(e) => setHasCurrentAccount(e.target.checked)} />
        Tiene cuenta corriente (compras habituales, factura mensual)
      </label>

      {error && <p role="alert" className="animate-shake text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={loading}>
        {loading ? "Guardando…" : "Guardar proveedor"}
      </Button>
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
    notify.success("Categoría creada");
    router.refresh();
  }

  async function toggleActive(category: Category) {
    const supabase = createClient();
    const { error } = await supabase.from("provider_categories").update({ active: !category.active }).eq("id", category.id);
    reportResult(error, category.active ? "Categoría archivada" : "Categoría reactivada");
    router.refresh();
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Categorías de proveedores</h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
            <span className={c.active ? "text-slate-700" : "text-slate-400"}>{c.name}</span>
            <Button variant="ghost" size="sm" onClick={() => toggleActive(c)}>
              {c.active ? "Desactivar" : "Activar"}
            </Button>
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
        <Button type="submit" loading={loading} className="shrink-0">
          Agregar
        </Button>
      </form>
      {error && <p role="alert" className="animate-shake mt-1 text-xs text-red-600">{error}</p>}
    </Card>
  );
}
