"use client";

import { inputClass, eyebrowClass } from "@/lib/ui";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify, reportResult } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import FilePreview from "@/components/FilePreview";
import ProviderCategoryPicker from "@/components/ProviderCategoryPicker";
import { formatDate, sanitizeFileName } from "@/lib/constants";
import type { Database } from "@/lib/database.types";
import InfoItem from "@/components/ui/InfoItem";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

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
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(provider.name);
  const [contactName, setContactName] = useState(provider.contact_name ?? "");
  const [email, setEmail] = useState(provider.email ?? "");
  const [phone, setPhone] = useState(provider.phone ?? "");
  const [taxId, setTaxId] = useState(provider.tax_id ?? "");
  const [taxStatus, setTaxStatus] = useState(provider.tax_status ?? "");
  const [paymentTerms, setPaymentTerms] = useState(provider.payment_terms ?? "");
  const [hasCurrentAccount, setHasCurrentAccount] = useState(provider.has_current_account);
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
    const { error } = await supabase.from("providers").update({ favorite: !provider.favorite }).eq("id", provider.id);
    reportResult(error, provider.favorite ? "Proveedor quitado de favoritos" : "Proveedor marcado como favorito");
    router.refresh();
  }

  async function toggleActive() {
    const supabase = createClient();
    const { error } = await supabase.from("providers").update({ active: !provider.active }).eq("id", provider.id);
    reportResult(error, provider.active ? "Proveedor archivado" : "Proveedor reactivado");
    router.refresh();
  }

  async function remove() {
    if (
      !(await confirm({
        title: `¿Eliminar definitivamente a ${provider.name}?`,
        description: "Se borran también sus comentarios y archivos. Esta acción no se puede deshacer.",
        confirmLabel: "Eliminar",
        destructive: true,
      }))
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from("providers").delete().eq("id", provider.id);
    reportResult(error, "Proveedor eliminado");
    router.refresh();
  }

  async function save() {
    setSaving(true);
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
        has_current_account: hasCurrentAccount,
      })
      .eq("id", provider.id);

    if (updateError) {
      setSaving(false);
      notify.error("No se pudo guardar el proveedor", updateError.message);
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
    notify.success("Proveedor actualizado");
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
      notify.error("No se pudo agregar el comentario", error.message);
      return;
    }
    setNewComment("");
    notify.success("Comentario agregado");
    router.refresh();
  }

  async function uploadFile(file: File) {
    setUploading(true);
    const supabase = createClient();
    const path = `${provider.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from("provider-files")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) {
      setUploading(false);
      notify.error("No se pudo subir el archivo", upErr.message);
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
      notify.error("No se pudo registrar el archivo", insertErr.message);
      return;
    }
    if (fileInput.current) fileInput.current.value = "";
    notify.success("Archivo subido");
    router.refresh();
  }

  return (
    <li className={`px-6 py-4 ${!provider.active ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={toggleFavorite}
            title={provider.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            className={`shrink-0 text-lg ${provider.favorite ? "text-amber-500" : "text-slate-300"}`}
          >
            ★
          </button>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-semibold text-slate-900">
              {provider.name}
              {!provider.active && <span className="ml-2 text-xs font-normal text-slate-400">(archivado)</span>}
            </p>
            <p className="truncate text-xs text-slate-500">
              {[provider.contact_name, provider.email, provider.phone].filter(Boolean).join(" · ") || "-"}
            </p>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {provider.has_current_account && (
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
              Cuenta corriente
            </span>
          )}
          {categoryNames.map((name) => (
            <span key={name} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {name}
            </span>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-5 border-t border-slate-100 pt-4">
          {!editing ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoItem label="CUIT" value={provider.tax_id || "-"} />
              <InfoItem label="Condición ante IVA" value={provider.tax_status || "-"} />
              <InfoItem label="Forma de pago" value={provider.payment_terms || "-"} />
              <InfoItem label="Contacto" value={provider.contact_name || "-"} />
              <InfoItem label="Cuenta corriente" value={provider.has_current_account ? "Habilitada" : "No"} />
              <div className="col-span-2 flex flex-wrap gap-2 pt-1">
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  Editar datos
                </Button>
                <Button variant="secondary" size="sm" onClick={toggleActive}>
                  {provider.active ? "Archivar" : "Reactivar"}
                </Button>
                <Button variant="danger-outline" size="sm" onClick={remove}>
                  Eliminar definitivamente
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={hasCurrentAccount}
                  onChange={(e) => setHasCurrentAccount(e.target.checked)}
                />
                Tiene cuenta corriente (compras habituales, factura mensual)
              </label>
              <div className="flex gap-2">
                <Button onClick={save} loading={saving}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div>
            <h3 className={eyebrowClass}>
              Comentarios ({comments.length})
            </h3>
            <div className="mt-2 space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <p className="text-slate-700">{c.comment}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {c.author?.full_name ?? "Alguien"} · {formatDate(c.created_at)}
                  </p>
                </div>
              ))}
              {comments.length === 0 && <EmptyState size="sm" title="Sin comentarios todavía." />}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Agregar un comentario…"
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={addComment}
                loading={commentLoading}
                disabled={!newComment.trim()}
                className="shrink-0"
              >
                Agregar
              </Button>
            </div>
          </div>

          <div>
            <h3 className={eyebrowClass}>
              Archivos ({files.length})
            </h3>
            <div className="mt-2 space-y-1">
              {files.map((f) => (
                <div key={f.id} className="text-sm">
                  <FilePreview url={f.url} fileName={f.file_name} />
                </div>
              ))}
              {files.length === 0 && <EmptyState size="sm" title="Sin archivos todavía." />}
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
        className={inputClass}
      />
    </div>
  );
}
