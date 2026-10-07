import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import SicActions from "@/components/SicActions";
import FilePreview from "@/components/FilePreview";
import ExportSicButton from "@/components/ExportSicButton";
import { IconArrowLeft } from "@/components/icons";
import {
  COMPRAS_EXPORTABLE_STATUSES,
  FILE_TYPE_LABELS,
  STATUS_LABELS,
  effectiveRole,
  formatAmount,
  formatDate,
  type SicFileType,
} from "@/lib/constants";
import type { SicExportRow } from "@/lib/exportSics";
import InfoItem from "@/components/ui/InfoItem";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SicDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;

  const supabase = createClient();

  const { data: sic, error: sicError } = await supabase
    .from("sics")
    .select(
      "*, plants(name, prefix), project:projects(id, name), provider:providers(name), requester:profiles!sics_requester_id_fkey(full_name, email, department), parent:sics!sics_parent_sic_id_fkey(id, code)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (sicError) throw new Error(sicError.message);
  if (!sic) notFound();

  const [{ data: events }, { data: files }, { data: items }, { data: projects }, { data: ccProviders }, { data: children }] = await Promise.all([
    supabase
      .from("sic_events")
      .select("*, actor:profiles(full_name)")
      .eq("sic_id", params.id)
      .order("created_at", { ascending: true }),
    supabase.from("sic_files").select("*").eq("sic_id", params.id).order("created_at", { ascending: true }),
    supabase.from("sic_items").select("*").eq("sic_id", params.id).order("position", { ascending: true }),
    supabase.from("projects").select("id, name").eq("active", true).order("name"),
    // Solo Compras/admin pueden leer proveedores; para el resto las listas llegan vacías.
    supabase.from("providers").select("id, name, has_current_account").eq("active", true).order("name"),
    supabase.from("sics").select("id, code, status").eq("parent_sic_id", params.id).order("created_at", { ascending: true }),
  ]);

  const filesWithUrls = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await supabase.storage.from("sic-files").createSignedUrl(f.storage_path, 300);
      return { ...f, url: data?.signedUrl ?? null };
    })
  );

  const requester = sic.requester as { full_name: string | null; email: string; department: string | null } | null;
  const plant = sic.plants as { name: string; prefix: string } | null;
  const project = sic.project as { id: string; name: string } | null;
  const provider = sic.provider as { name: string } | null;
  const parentRaw = sic.parent as unknown;
  const parentSic = (Array.isArray(parentRaw) ? parentRaw[0] : parentRaw) as { id: string; code: string } | null | undefined;
  const activeItems = (items ?? []).filter((it) => it.review_status === "activo");
  const isCurrentAccount = sic.purchase_type === "cuenta_corriente";
  const isDirect = sic.purchase_type === "directa";
  const activeProviders = (ccProviders ?? []) as { id: string; name: string; has_current_account: boolean }[];

  const canExport = (role === "compras" || role === "admin") && COMPRAS_EXPORTABLE_STATUSES.includes(sic.status);
  const exportRows: SicExportRow[] = activeItems.map((it) => ({
    codigo: sic.code,
    asunto: sic.subject,
    planta: plant ? `${plant.name} (${plant.prefix})` : "-",
    proyecto: project?.name ?? "-",
    solicitante: requester?.full_name ?? requester?.email ?? "-",
    area: sic.department ?? "-",
    fechaNecesaria: sic.needed_by_date ? formatDate(sic.needed_by_date) : "-",
    articulo: it.description,
    cantidad: it.quantity,
    especificaciones: it.specs ?? "",
  }));

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <IconArrowLeft />
          Volver al tablero
        </Link>

        <div className="mt-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{sic.code}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{sic.subject}</h1>
          </div>
          <div className="flex items-center gap-3">
            {canExport && (
              <ExportSicButton rows={exportRows} filename={`${sic.code}.xlsx`} label="Exportar a Excel" />
            )}
            {isCurrentAccount && (
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                Cuenta corriente
              </span>
            )}
            {isDirect && (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                Compra directa
              </span>
            )}
            <StatusBadge status={sic.status} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <InfoItem label="Planta" value={plant ? `${plant.name} (${plant.prefix})` : "-"} />
          <InfoItem label="Proyecto" value={project?.name ?? "-"} />
          <InfoItem label="Solicitante" value={requester?.full_name ?? requester?.email ?? "-"} />
          <InfoItem label="Área / Departamento" value={sic.department ?? "-"} />
          {sic.on_behalf_of && <InfoItem label="Solicitado en nombre de" value={sic.on_behalf_of} />}
          <InfoItem label="Necesaria para" value={sic.needed_by_date ? formatDate(sic.needed_by_date) : "-"} />
          <InfoItem label="Creada" value={formatDate(sic.created_at)} />
          {(isCurrentAccount || isDirect) && (
            <InfoItem label="Tipo de compra" value={isDirect ? "Compra directa" : "Cuenta corriente"} />
          )}
          {(isCurrentAccount || isDirect) && <InfoItem label="Proveedor" value={provider?.name ?? "-"} />}
          <InfoItem label="Monto final" value={formatAmount(sic.final_amount, sic.currency)} />
          <InfoItem label="Orden de compra" value={sic.po_number ?? "-"} />
          <InfoItem label="Última actualización" value={formatDate(sic.updated_at)} />
        </div>

        {(parentSic || (children ?? []).length > 0) && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
            {parentSic && (
              <p>
                Desprendida de{" "}
                <Link href={`/sic/${parentSic.id}`} className="font-semibold underline">
                  {parentSic.code}
                </Link>
                : estos artículos fueron observados en la revisión y se corrigen acá.
              </p>
            )}
            {(children ?? []).length > 0 && (
              <p>
                Artículos observados que pasaron a una SIC nueva:{" "}
                {(children ?? []).map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link href={`/sic/${c.id}`} className="font-semibold underline">
                      {c.code}
                    </Link>{" "}
                    ({STATUS_LABELS[c.status]})
                  </span>
                ))}
                .
              </p>
            )}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-semibold text-slate-900">Artículos solicitados</h2>
          <div className="mt-3 space-y-3">
            {(items ?? []).map((item, i) => {
              const itemFile = filesWithUrls.find((f) => f.item_id === item.id && f.file_type === "referencia");
              const itemCertFiles = filesWithUrls.filter(
                (f) => f.item_id === item.id && f.file_type === "certificado_calidad"
              );
              const rejected = item.review_status === "rechazado";
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 ${rejected ? "border-red-200 bg-red-50/50" : "border-slate-200"}`}
                >
                  {rejected && (
                    <p className="mb-1 text-xs font-semibold text-red-700">
                      Rechazado — no se compra{item.review_note ? `: ${item.review_note}` : ""}
                    </p>
                  )}
                  {!rejected && item.review_note && sic.status === "en_observacion" && (
                    <p className="mb-1 text-xs font-semibold text-amber-700">Observación: {item.review_note}</p>
                  )}
                  <p className={`font-medium ${rejected ? "text-slate-400 line-through" : "text-slate-800"}`}>
                    {i + 1}. {item.description} — {item.quantity}
                    {!rejected && item.received_quantity > 0 && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        ({item.received_quantity}/{item.quantity} recibido)
                      </span>
                    )}
                  </p>
                  {item.specs && <p className="mt-1 text-slate-500">{item.specs}</p>}
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    {item.reference_link && (
                      <a href={item.reference_link} target="_blank" className="text-slate-900 underline">
                        Link de referencia
                      </a>
                    )}
                    {itemFile && (
                      <FilePreview url={itemFile.url} fileName={itemFile.file_name} />
                    )}
                  </div>
                  {item.requires_quality_cert && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-medium text-slate-500">Certificado de calidad:</span>
                      {itemCertFiles.length === 0 ? (
                        <span className="text-amber-600">Pendiente</span>
                      ) : (
                        itemCertFiles.map((f) => (
                          <FilePreview key={f.id} url={f.url} fileName={f.file_name} label="Ver" />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-semibold text-slate-900">Archivos de la SIC</h2>
          {filesWithUrls.filter((f) => !f.item_id).length === 0 ? (
            <p className="mt-2 text-slate-400">Todavía no hay archivos adjuntos.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {filesWithUrls
                .filter((f) => !f.item_id)
                .map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">
                      {FILE_TYPE_LABELS[f.file_type as SicFileType]}: {f.file_name}
                    </span>
                    <FilePreview url={f.url} fileName={f.file_name} label="Ver" />
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <SicActions
            sicId={sic.id}
            status={sic.status}
            role={role}
            isRequester={sic.requester_id === profile.id}
            isAreaBoss={role === "area" && !!profile.plant_id && profile.plant_id === sic.plant_id}
            existingFiles={(files ?? [])
              .filter((f) => !f.item_id)
              .map((f) => ({
                id: f.id,
                file_type: f.file_type as SicFileType,
                storage_path: f.storage_path,
                file_name: f.file_name,
              }))}
            editData={{
              subject: sic.subject,
              projectId: sic.project_id,
              neededByDate: sic.needed_by_date,
              items: activeItems.map((it) => ({
                id: it.id,
                description: it.description,
                quantity: it.quantity,
                receivedQuantity: it.received_quantity,
                specs: it.specs,
                referenceLink: it.reference_link,
                existingFileName:
                  filesWithUrls.find((f) => f.item_id === it.id && f.file_type === "referencia")?.file_name ??
                  null,
                existingFileId: filesWithUrls.find((f) => f.item_id === it.id && f.file_type === "referencia")?.id ?? null,
                existingFilePath:
                  filesWithUrls.find((f) => f.item_id === it.id && f.file_type === "referencia")?.storage_path ?? null,
                reviewNote: it.review_note,
                requiresQualityCert: it.requires_quality_cert,
                certFiles: (files ?? [])
                  .filter((f) => f.item_id === it.id && f.file_type === "certificado_calidad")
                  .map((f) => ({
                    id: f.id,
                    file_type: f.file_type as SicFileType,
                    storage_path: f.storage_path,
                    file_name: f.file_name,
                  })),
              })),
            }}
            projects={projects ?? []}
            purchaseType={sic.purchase_type as "normal" | "cuenta_corriente" | "directa"}
            finalAmount={sic.final_amount}
            currentAccountProviders={activeProviders.filter((p) => p.has_current_account)}
            allProviders={activeProviders}
          />
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-semibold text-slate-900">Historial</h2>
          <ul className="mt-3 space-y-3">
            {events?.map((ev) => (
              <li key={ev.id} className="border-l-2 border-slate-200 pl-3">
                <p className="text-slate-700">
                  {(ev.actor as { full_name: string | null } | null)?.full_name ?? "Sistema"} →{" "}
                  <span className="font-medium">{STATUS_LABELS[ev.to_status]}</span>
                </p>
                {ev.note && <p className="text-slate-500">{ev.note}</p>}
                <p className="text-xs text-slate-400">{formatDate(ev.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
