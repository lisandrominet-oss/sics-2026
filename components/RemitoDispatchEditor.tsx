"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { compressImage } from "@/lib/remitosFiles";
import { filterClass, inputClass, numClass } from "@/lib/ui";
import {
  CATEGORY_LABELS, KIND_LABELS, REMITO_BUCKET, fmtQty, fromLocalInput, toLocalInput, untyped,
  type RemitoCategory, type RemitoDispatch, type RemitoFile, type RemitoItem, type RemitoKind, type RemitoProject,
} from "@/lib/remitos";

export type EditorLine = {
  key: string;
  item_id: string;
  qty: string;
  condition: RemitoCategory;
  est_return_date: string;
  official_no: string;
  notes: string;
};

export type EditorFile = RemitoFile & { url: string | null };

type Props = {
  projects: RemitoProject[];
  /** Ítems aprobados por Calidad (los únicos que se pueden cargar). */
  items: RemitoItem[];
  dispatch?: RemitoDispatch;
  lines?: EditorLine[];
  files?: EditorFile[];
  signatureUrl?: string | null;
};

const CONDITIONS_BY_KIND: Record<RemitoKind, RemitoCategory[]> = {
  permanente: ["permanente"],
  retornable: ["retornable", "consumible"],
  mixto: ["permanente", "retornable", "consumible"],
};

// Si la condición de una línea no es válida para el tipo de remito, se corrige a la más cercana.
function fitCondition(kind: RemitoKind | "", cond: RemitoCategory): RemitoCategory {
  if (!kind) return cond;
  const ok = CONDITIONS_BY_KIND[kind];
  return ok.includes(cond) ? cond : ok[0];
}

function newKey() {
  return Math.random().toString(36).slice(2);
}

export default function RemitoDispatchEditor({ projects, items, dispatch, lines: initialLines, files = [], signatureUrl }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const supabase = useMemo(() => untyped(createClient()), []);
  const padRef = useRef<SignaturePadHandle>(null);
  const [padEmpty, setPadEmpty] = useState(true);

  const [kind, setKind] = useState<RemitoKind | "">(dispatch?.kind ?? "");
  const [projectId, setProjectId] = useState(dispatch?.project_id ?? projects[0]?.id ?? "");
  // En un despacho nuevo la hora por defecto se pone ya en el navegador (en el servidor puede ser otra zona horaria).
  const [when, setWhen] = useState(dispatch ? toLocalInput(dispatch.dispatched_at) : "");
  useEffect(() => {
    if (!dispatch) setWhen((w) => w || toLocalInput(null));
  }, [dispatch]);
  const [reason, setReason] = useState(dispatch?.reason ?? "");
  const [carrier, setCarrier] = useState(dispatch?.carrier_company ?? "");
  const [driver, setDriver] = useState(dispatch?.driver_name ?? "");
  const [dni, setDni] = useState(dispatch?.driver_dni ?? "");
  const [tractor, setTractor] = useState(dispatch?.tractor_plate ?? "");
  const [trailer, setTrailer] = useState(dispatch?.trailer_plate ?? "");
  const [notes, setNotes] = useState(dispatch?.notes ?? "");
  const [driverConfirmed, setDriverConfirmed] = useState(dispatch?.driver_confirmed ?? false);
  const [lines, setLines] = useState<EditorLine[]>(initialLines ?? []);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<null | "save" | "confirm" | "cancel" | "upload" | "signature">(null);

  const id = dispatch?.id ?? null;
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const usedIds = new Set(lines.map((l) => l.item_id));

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)).slice(0, 8);
  }, [items, search]);

  const photosCarga = files.filter((f) => f.kind === "carga");
  const photosPat = files.filter((f) => f.kind === "patentes");
  const hasSignature = !!dispatch?.signature_path;

  // Candados de salida: lo mismo que valida la base al confirmar.
  const checks = [
    { ok: !!kind && !!projectId, label: "Tipo de remito y proyecto" },
    { ok: lines.length > 0, label: "Al menos un ítem cargado" },
    { ok: driver.trim() !== "" && tractor.trim() !== "", label: "Chofer y patente del tractor" },
    { ok: photosCarga.length > 0, label: "Foto de la carga" },
    { ok: photosPat.length > 0, label: "Foto de patentes / seguridad" },
    { ok: hasSignature || driverConfirmed, label: "Firma del chofer o su confirmación" },
  ];
  const allOk = checks.every((c) => c.ok);

  function changeKind(next: RemitoKind | "") {
    setKind(next);
    setLines((prev) => prev.map((l) => ({ ...l, condition: fitCondition(next, l.condition) })));
  }

  function addItem(item: RemitoItem) {
    setLines((prev) => [
      ...prev,
      { key: newKey(), item_id: item.id, qty: "1", condition: fitCondition(kind, item.category), est_return_date: "", official_no: "", notes: "" },
    ]);
    setSearch("");
  }
  function patchLine(key: string, patch: Partial<EditorLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function payload() {
    return {
      header: {
        kind, project_id: projectId, dispatched_at: fromLocalInput(when), reason, carrier_company: carrier,
        driver_name: driver, driver_dni: dni, tractor_plate: tractor, trailer_plate: trailer, notes,
        driver_confirmed: driverConfirmed,
      },
      lines: lines.map((l) => ({
        item_id: l.item_id, qty: Number(String(l.qty).replace(",", ".")), condition: l.condition,
        est_return_date: l.est_return_date, official_no: l.official_no, notes: l.notes,
      })),
    };
  }

  // Guarda el borrador y devuelve el id (o null si falló).
  async function save(quiet = false): Promise<string | null> {
    if (!kind) {
      notify.error("Elegí el tipo de remito");
      return null;
    }
    const p = payload();
    const { data, error } = await supabase.rpc("remito_save_dispatch", { p_dispatch_id: id, p_header: p.header, p_lines: p.lines });
    if (error) {
      notify.error("No se pudo guardar el borrador", error.message);
      return null;
    }
    if (!quiet) notify.success("Borrador guardado");
    return data as string;
  }

  async function onSave() {
    setBusy("save");
    const savedId = await save();
    setBusy(null);
    if (!savedId) return;
    if (!id) router.replace(`/remitos/${savedId}`);
    else router.refresh();
  }

  async function onConfirm() {
    if (!id) return;
    if (!(await confirm({
      title: "Confirmar la salida del camión",
      description: "Se asigna el número de remito, se descuenta el stock y el despacho ya no se puede editar.",
      confirmLabel: "Confirmar salida",
    }))) return;
    setBusy("confirm");
    const savedId = await save(true);
    if (!savedId) return setBusy(null);
    const { data, error } = await supabase.rpc("remito_confirm_dispatch", { p_dispatch_id: id });
    setBusy(null);
    if (error) return notify.error("No se pudo confirmar la salida", error.message);
    notify.success(`Salida confirmada · ${data as string}`);
    router.refresh();
  }

  async function onCancel() {
    if (!id) return;
    if (!(await confirm({ title: "Anular este borrador", description: "El borrador queda anulado y no se puede reabrir.", confirmLabel: "Anular", destructive: true }))) return;
    setBusy("cancel");
    const { error } = await supabase.rpc("remito_cancel_dispatch", { p_dispatch_id: id, p_reason: null });
    setBusy(null);
    if (error) return notify.error("No se pudo anular", error.message);
    notify.success("Borrador anulado");
    router.push("/remitos");
    router.refresh();
  }

  async function uploadPhotos(fileKind: "carga" | "patentes", list: FileList | null) {
    if (!id || !list || list.length === 0) return;
    setBusy("upload");
    try {
      for (const file of Array.from(list)) {
        const blob = await compressImage(file);
        const path = `${id}/${fileKind}-${Date.now()}-${newKey()}.jpg`;
        const up = await supabase.storage.from(REMITO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw new Error(up.error.message);
        const { error } = await supabase.rpc("remito_attach_file", { p_dispatch_id: id, p_kind: fileKind, p_path: path });
        if (error) {
          await supabase.storage.from(REMITO_BUCKET).remove([path]);
          throw new Error(error.message);
        }
      }
      notify.success(list.length > 1 ? "Fotos cargadas" : "Foto cargada");
      router.refresh();
    } catch (err) {
      notify.error("No se pudo subir la foto", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function removePhoto(file: EditorFile) {
    const { data, error } = await supabase.rpc("remito_remove_file", { p_file_id: file.id });
    if (error) return notify.error("No se pudo quitar la foto", error.message);
    if (data) {
      const { error: rmError } = await supabase.storage.from(REMITO_BUCKET).remove([data as string]);
      if (rmError) notify.warning("La foto se quitó del despacho, pero el archivo quedó en el almacenamiento", rmError.message);
    }
    router.refresh();
  }

  async function saveSignature() {
    if (!id) return;
    const blob = await padRef.current?.toBlob();
    if (!blob) return notify.error("Primero firmá en el recuadro");
    setBusy("signature");
    const path = `${id}/firma-${Date.now()}.png`;
    const up = await supabase.storage.from(REMITO_BUCKET).upload(path, blob, { contentType: "image/png" });
    if (up.error) {
      setBusy(null);
      return notify.error("No se pudo subir la firma", up.error.message);
    }
    const { error } = await supabase.rpc("remito_set_signature", { p_dispatch_id: id, p_path: path });
    setBusy(null);
    if (error) {
      await supabase.storage.from(REMITO_BUCKET).remove([path]);
      return notify.error("No se pudo guardar la firma", error.message);
    }
    notify.success("Firma guardada");
    padRef.current?.clear();
    router.refresh();
  }

  async function clearSignature() {
    if (!id) return;
    const { error } = await supabase.rpc("remito_set_signature", { p_dispatch_id: id, p_path: null });
    if (error) return notify.error("No se pudo quitar la firma", error.message);
    router.refresh();
  }

  const kindConditions = kind ? CONDITIONS_BY_KIND[kind] : (["permanente", "retornable", "consumible"] as RemitoCategory[]);

  return (
    <div className="mt-5 space-y-6">
      <Card title="1 · Cabecera">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tipo de remito *" hint={id ? undefined : "El número interno se asigna recién al confirmar la salida."}>
            {(p) => (
              <select {...p} value={kind} onChange={(e) => changeKind(e.target.value as RemitoKind | "")} className={inputClass}>
                <option value="">— elegir —</option>
                {(Object.keys(KIND_LABELS) as RemitoKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select>
            )}
          </Field>
          <Field label="Proyecto / tinglado de destino *">
            {(p) => (
              <select {...p} value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
                {projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.code} · {pr.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Fecha y hora de despacho">{(p) => <input {...p} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} />}</Field>
          <Field label="Motivo (sale impreso en el remito)" className="sm:col-span-2 lg:col-span-3">{(p) => <input {...p} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />}</Field>
        </div>
        <h3 className="mt-6 text-sm font-semibold text-slate-900">Transportista</h3>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Empresa de flete">{(p) => <input {...p} value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputClass} />}</Field>
          <Field label="Chofer (nombre y apellido) *">{(p) => <input {...p} value={driver} onChange={(e) => setDriver(e.target.value)} className={inputClass} />}</Field>
          <Field label="DNI">{(p) => <input {...p} inputMode="numeric" value={dni} onChange={(e) => setDni(e.target.value)} className={inputClass} />}</Field>
          <Field label="Patente tractor *">{(p) => <input {...p} value={tractor} onChange={(e) => setTractor(e.target.value.toUpperCase())} className={`${inputClass} uppercase`} />}</Field>
          <Field label="Patente acoplado">{(p) => <input {...p} value={trailer} onChange={(e) => setTrailer(e.target.value.toUpperCase())} className={`${inputClass} uppercase`} />}</Field>
          <Field label="Observaciones" className="sm:col-span-2 lg:col-span-3">{(p) => <textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />}</Field>
        </div>
      </Card>

      <Card title="2 · Armado del camión">
        <Field label="Agregar ítem aprobado" hint={items.length === 0 ? "No hay ítems aprobados por Calidad todavía." : "Solo aparecen los ítems aprobados por Calidad."}>
          {(p) => <input {...p} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código o descripción" className={inputClass} />}
        </Field>
        {matches.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {matches.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className={`mr-2 font-medium text-slate-900 ${numClass}`}>{i.code}</span>
                  <span className="text-slate-700">{i.description}</span>
                  <span className={`ml-2 text-xs text-slate-500 ${numClass}`}>Stock {fmtQty(i.stock)} {i.unit}</span>
                </span>
                <Button size="sm" variant="secondary" disabled={usedIds.has(i.id)} onClick={() => addItem(i)}>
                  {usedIds.has(i.id) ? "Cargado" : "Agregar"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 text-sm font-semibold text-slate-900">Carga del camión</h3>
        {lines.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Todavía no cargaste ítems. Elegilos del buscador.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {lines.map((l, idx) => {
              const item = itemById.get(l.item_id);
              const overStock = item && Number(l.qty) > item.stock;
              return (
                <li key={l.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 text-sm">
                      <span className="mr-2 text-slate-500">{idx + 1}.</span>
                      <span className={`mr-2 font-medium text-slate-900 ${numClass}`}>{item?.code ?? "?"}</span>
                      <span className="text-slate-700">{item?.description ?? "Ítem no disponible"}</span>
                    </p>
                    <Button variant="link-danger" size="sm" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}>Quitar</Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <Field label="Cantidad" error={overStock ? `Hay ${fmtQty(item?.stock)}` : null}>
                      {(p) => <input {...p} type="number" min="0" step="0.01" inputMode="decimal" value={l.qty} onChange={(e) => patchLine(l.key, { qty: e.target.value })} className={inputClass} />}
                    </Field>
                    <Field label="Condición">
                      {(p) => (
                        <select {...p} value={l.condition} onChange={(e) => patchLine(l.key, { condition: e.target.value as RemitoCategory })} className={inputClass}>
                          {kindConditions.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                        </select>
                      )}
                    </Field>
                    <Field label="Devolución est.">{(p) => <input {...p} type="date" value={l.est_return_date} onChange={(e) => patchLine(l.key, { est_return_date: e.target.value })} className={inputClass} />}</Field>
                    <Field label="N° rem. oficial">{(p) => <input {...p} value={l.official_no} onChange={(e) => patchLine(l.key, { official_no: e.target.value })} className={inputClass} />}</Field>
                    <Field label="Obs. / N° de serie" className="col-span-2 lg:col-span-1">{(p) => <input {...p} value={l.notes} onChange={(e) => patchLine(l.key, { notes: e.target.value })} className={inputClass} />}</Field>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">«N° rem. oficial» solo si ese ítem salió con otro remito oficial distinto al del encabezado. La fecha de devolución es opcional.</p>
      </Card>

      <Card title="3 · Candados de salida">
        {!id ? (
          <p className="text-sm text-slate-500">Guardá el borrador para cargar las fotos y la firma del chofer.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PhotoBlock title="Foto de la carga sobre el camión" hint="Al menos 1. Desde el celular abre la cámara." files={photosCarga} busy={busy === "upload"} onPick={(l) => uploadPhotos("carga", l)} onRemove={removePhoto} />
            <PhotoBlock title="Foto de patentes / seguridad" hint="Al menos 1 (patentes, estiba, precintos, EPP)." files={photosPat} busy={busy === "upload"} onPick={(l) => uploadPhotos("patentes", l)} onRemove={removePhoto} />
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-900">Firma del chofer</h3>
              {hasSignature && signatureUrl && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signatureUrl} alt="Firma del chofer" className="h-20 rounded-lg border border-slate-200 bg-white" />
                  <Button variant="link-danger" size="sm" onClick={clearSignature}>Quitar firma</Button>
                </div>
              )}
              <div className="mt-2 max-w-xl">
                <SignaturePad ref={padRef} onChange={setPadEmpty} disabled={busy === "signature"} />
                <Button className="mt-2" variant="secondary" size="sm" disabled={padEmpty} loading={busy === "signature"} onClick={saveSignature}>
                  {hasSignature ? "Reemplazar firma" : "Guardar firma"}
                </Button>
              </div>
              <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-slate-800 sm:min-h-0">
                <input type="checkbox" checked={driverConfirmed} onChange={(e) => setDriverConfirmed(e.target.checked)} className="h-4 w-4" />
                El chofer confirma la recepción de la carga (alternativa a la firma)
              </label>
              <p className="mt-1 text-xs text-slate-500">La tilde se guarda con «Guardar borrador».</p>
            </div>
          </div>
        )}
      </Card>

      <Card title="Antes de confirmar">
        <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <Badge tone={c.ok ? "success" : "warning"} size="sm">{c.ok ? "Listo" : "Falta"}</Badge>
              <span className="text-slate-700">{c.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Los ítems sin aprobación de Calidad no pueden cargarse en el camión. Las fotos y la firma se pueden completar luego desde el borrador.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" loading={busy === "save"} onClick={onSave}>Guardar borrador</Button>
          <Button loading={busy === "confirm"} disabled={!id || !allOk} onClick={onConfirm}>Confirmar salida</Button>
          {id && <Button variant="danger-outline" loading={busy === "cancel"} onClick={onCancel}>Anular borrador</Button>}
        </div>
        {!id && <p className="mt-2 text-xs text-slate-500">Para confirmar, primero guardá el borrador y cargá fotos y firma.</p>}
      </Card>
    </div>
  );
}

function PhotoBlock({
  title, hint, files, busy, onPick, onRemove,
}: {
  title: string;
  hint: string;
  files: EditorFile[];
  busy: boolean;
  onPick: (list: FileList | null) => void;
  onRemove: (f: EditorFile) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {files.map((f) => (
          <div key={f.id} className="relative">
            {f.url ? (
              <a href={f.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={title} className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
              </a>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-slate-200 text-xs text-slate-500">Sin vista</div>
            )}
            <button
              type="button"
              onClick={() => onRemove(f)}
              aria-label="Quitar foto"
              className="absolute -right-3 -top-3 flex h-11 w-11 items-start justify-end sm:-right-2 sm:-top-2 sm:h-6 sm:w-6"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-on-ink">×</span>
            </button>
          </div>
        ))}
      </div>
      <label className={`${filterClass} mt-2 inline-flex cursor-pointer items-center ${busy ? "pointer-events-none opacity-60" : ""}`}>
        {busy ? "Subiendo…" : "Agregar foto"}
        <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
      </label>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
