"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FilePreview from "@/components/FilePreview";
import ProviderCategoryPicker from "@/components/ProviderCategoryPicker";
import type { Database } from "@/lib/database.types";

type Provider = Database["public"]["Tables"]["providers"]["Row"];
type Category = { id: string; name: string; active: boolean };
type Comment = {
  id: string;
  author_id: string | null;
  comment: string;
  created_at: string;
  author: { full_name: string | null } | null;
};
type ProviderFile = {
  id: string;
  storage_path: string;
  file_name: string;
  created_at: string;
  url: string | null;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export default function ProviderRow({
  provider,
  categories,
  categoryIds,
  comments,
  files,
  currentUserId,
  onCategoryCreated,
}: {
  provider: Provider;
  categories: Category[];
  categoryIds: string[];
  comments: Comment[];
  files: ProviderFile[];
  currentUserId: string;
  onCategoryCreated: (category: Category) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(provider.name);
  const [contactName, setContactName] = useState(provider.contact_name ?? "");
  const [email, setEmail] = useState(provider.email ?? "");
  const [phone, setPhone] = useState(provider.phone ?? "");
  const [taxId, setTaxId] = useState(provider.tax_id ?? "");
  const [taxStatus, setTaxStatus] = useState(provider.tax_status ?? "");
  const [paymentTerms, setPaymentTerms] = useState(provider.payment_terms ?? "");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(categoryIds);

  const [newComment, setNewComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const categoryNames = categories.filter((c) => categoryIds.includes(c.id)).map((c) => c.name);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function toggleFavorite() {
    const supabase = createClient();
    await supabase.from("providers").update({ favorite: !provider.favorite }).eq("id", provider.id);
    router.refresh();
  }

  async function toggleActive() {
    const supabase = createClient();
    await supabase.from("providers").update({ active: !provider.active }).eq("id", provider.id);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`¿Eliminar definitivamente a ${provider.name}? Se borran también sus comentarios y archivos.`))
      return;
    const supabase = createClient();
    await supabase.from("providers").delete().eq("id", provider.id);
    router.refresh();
  }

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("providers")
      .update({
        name,
        contact_name: contactName || null,
        email: email || null,
        phone: phone || null,
        tax_id: taxId || null,
        tax_status: taxStatus || null,
        payment_terms: paymentTerms || null,
      })
      .eq("id", provider.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    const toRemove = categoryIds.filter((id) => !selectedCategoryIds.includes(id));
    const toAdd = selectedCategoryIds.filter((id) => !categoryIds.includes(id));

    if (toRemove.length > 0) {
      await supabase
        .from("provider_category_links")
        .delete()
        .eq("provider_id", provider.id)
        .in("category_id", toRemove);
    }
    if (toAdd.length > 0) {
      await supabase
        .from("provider_category_links")
        .insert(toAdd.map((category_id) => ({ provider_id: provider.id, category_id })));
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function addComment() {
    const text = newComment.trim();
    if (!text) return;
    setCommentLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("provider_comments")
      .insert({ provider_id: provider.id, author_id: currentUserId, comment: text });
    setCommentLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNewComment("");
    router.refresh();
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${provider.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("provider-files")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }
    const { error: insertErr } = await supabase.from("provider_files").insert({
      provider_id: provider.id,
      storage_path: path,
      file_name: file.name,
      uploaded_by: currentUserId,
    });
    setUploading(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  return (
    <li className={`px-6 py-4 ${!provider.active ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite();
            }}
            title={provider.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            className={`shrink-0 text-lg ${provider.favorite ? "text-amber-500" : "text-slate-300"}`}
          >
            ★
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {provider.name}
              {!provider.active && <span className="ml-2 text-xs font-normal text-slate-400">(archivado)</span>}
            </p>
            <p className="truncate text-xs text-slate-500">
              {[provider.contact_name, provider.email, provider.phone].filter(Boolean).join(" · ") || "-"}
            </p>
          </div>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryNames.map((name) => (
            <span key={name} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
              {name}
            </span>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-5 border-t border-slate-100 pt-4">
          {!editing ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="CUIT" value={provider.tax_id} />
              <Field label="Condición ante IVA" value={provider.tax_status} />
              <Field label="Forma de pago" value={provider.payment_terms} />
              <Field label="Contacto" value={provider.contact_name} />
              <div className="col-span-2 flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Editar datos
                </button>
                <button
                  onClick={toggleActive}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {provider.active ? "Archivar" : "Reactivar"}
                </button>
                <button
                  onClick={remove}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Eliminar definitivamente
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput label="Nombre" value={name} onChange={setName} />
                <LabeledInput label="Contacto" value={contactName} onChange={setContactName} />
                <LabeledInput label="Mail" value={email} onChange={setEmail} />
                <LabeledInput label="Teléfono" value={phone} onChange={setPhone} />
                <LabeledInput label="CUIT" value={taxId} onChange={setTaxId} />
                <LabeledInput
                  label="Condición ante IVA"
                  value={taxStatus}
                  onChange={setTaxStatus}
                  placeholder="Ej: Responsable Inscripto"
                />
                <div className="col-span-2">
                  <LabeledInput
                    label="Forma de pago"
                    value={paymentTerms}
                    onChange={setPaymentTerms}
                    placeholder="Ej: Cta. cte. 30 días, Contado"
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
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Comentarios ({comments.length})
            </h3>
            <div className="mt-2 space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <p className="text-slate-700">{c.comment}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {c.author?.full_name ?? "Alguien"} · {formatDate(c.created_at)}
                  </p>
                </div>
              ))}
              {comments.length === 0 && <p className="text-xs text-slate-400">Sin comentarios todavía.</p>}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Agregar un comentario…"
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                onClick={addComment}
                disabled={commentLoading || !newComment.trim()}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Archivos ({files.length})
            </h3>
            <div className="mt-2 space-y-1">
              {files.map((f) => (
                <div key={f.id} className="text-sm">
                  <FilePreview url={f.url} fileName={f.file_name} />
                </div>
              ))}
              {files.length === 0 && <p className="text-xs text-slate-400">Sin archivos todavía.</p>}
            </div>
            <div className="mt-2">
              <input
                ref={fileInput}
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                }}
                disabled={uploading}
                className="text-xs text-slate-500"
              />
              {uploading && <p className="mt-1 text-xs text-slate-400">Subiendo…</p>}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="text-slate-700">{value || "-"}</p>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
