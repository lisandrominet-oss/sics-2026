import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import SicActions from "@/components/SicActions";
import FilePreview from "@/components/FilePreview";
import ExportSicButton from "@/components/ExportSicButton";
import { IconArrowLeft, IconFileText } from "@/components/icons";
import {
  COMPRAS_EXPORTABLE_STATUSES,
  FILE_TYPE_LABELS,
  STATUS_LABELS,
  daysUntilSqlDate,
  effectiveRole,
  formatAmount,
  formatDate,
  formatSqlDate,
  type SicFileType,
  type SicStatus,
} from "@/lib/constants";
import type { SicExportRow } from "@/lib/exportSics";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { eyebrowClass, numClass } from "@/lib/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Con la SIC ya resuelta (o rechazada) la fecha necesaria deja de correr: no se muestra la cuenta de días.
const NO_DEADLINE_STATUSES: SicStatus[] = ["rechazada_jefe", "rechazada_compras", "rechazada_gerencia", "recibida", "cerrada", "anulada"];

function deadlineText(days: number) {
  if (days === 0) return "Es hoy";
  if (days === 1) return "Falta 1 día";
  if (days > 1) return `Faltan ${days} días`;
  return days === -1 ? "Vencida hace 1 día" : `Vencida hace ${-days} días`;
}

export default async function SicDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;

  const supabase = createClient();

  const { data: sic, error: sicError } = await supabase
    .from("sics")
    .select(
      "*, plants(name, prefix), project:projects(id, name), provider:providers(name), requester:profiles!sics_requester_id_fkey(full_name, email, department)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (sicError) throw new Error(sicError.message);
  if (!sic) notFound();

  const [{ data: events }, { data: files }, { data: items }, { data: projects }, { data: ccProviders }, { data: children }, { data: parentSic }] = await Promise.all([
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
    // La SIC de origen va en consulta aparte: PostgREST no resuelve el embed de una FK autorreferenciada por nombre de constraint (PGRST200).
    sic.parent_sic_id
      ? supabase.from("sics").select("id, code").eq("id", sic.parent_sic_id).maybeSingle()
      : Promise.resolve({ data: null }),
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
  const activeItems = (items ?? []).filter((it) => it.review_status === "activo");
  const rejectedCount = (items ?? []).length - activeItems.length;
  const isCurrentAccount = sic.purchase_type === "cuenta_corriente";
  const isDirect = sic.purchase_type === "directa";
  const activeProviders = (ccProviders ?? []) as { id: string; name: string; has_current_account: boolean }[];

  const isRequester = sic.requester_id === profile.id;
  const isAreaBoss = role === "area" && !!profile.plant_id && profile.plant_id === sic.plant_id;
  // Aviso "te toca aprobar": mantener junto con las condiciones de SicActions.renderStatusPanel (aprobación del jefe, validación técnica y Gerencia).
  const needsMyApproval =
    (sic.status === "pendiente_aprobacion_jefe" && (role === "admin" || isAreaBoss)) ||
    (sic.status === "pendiente_validacion_tecnica" && (role === "admin" || isRequester || isAreaBoss)) ||
    (sic.status === "pendiente_aprobacion_gerencia" && (role === "gerencia" || role === "admin"));

  // El formulario de corrección de artículos necesita ancho: en ese estado la pantalla vuelve a una sola columna.
  const stacked = sic.status === "en_observacion" && (role === "admin" || isRequester);

  const requesterName = requester?.full_name ?? requester?.email ?? "-";
  const daysLeft = sic.needed_by_date && !NO_DEADLINE_STATUSES.includes(sic.status) ? daysUntilSqlDate(sic.needed_by_date) : null;
  const sicFiles = filesWithUrls.filter((f) => !f.item_id);

  const canExport = (role === "compras" || role === "admin") && COMPRAS_EXPORTABLE_STATUSES.includes(sic.status);
  const exportRows: SicExportRow[] = activeItems.map((it) => ({
    codigo: sic.code,
    asunto: sic.subject,
    planta: plant ? `${plant.name} (${plant.prefix})` : "-",
    proyecto: project?.name ?? "-",
    solicitante: requester?.full_name ?? requester?.email ?? "-",
    area: sic.department ?? "-",
    fechaNecesaria: sic.needed_by_date ? formatSqlDate(sic.needed_by_date) : "-",
    articulo: it.description,
    cantidad: it.quantity,
    especificaciones: it.specs ?? "",
  }));

  return (
    <div className={cn("mx-auto", stacked ? "max-w-3xl" : "max-w-6xl")}>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <IconArrowLeft />
        Volver al tablero
      </Link>

      <PageHeader
        className="mt-4 !items-start"
        eyebrow={
          <span className={numClass}>
            {sic.code}
            {plant ? ` · ${plant.name} (${plant.prefix})` : ""}
          </span>
        }
        title={sic.subject}
        description={`Pedida por ${requesterName}${project ? ` · Proyecto ${project.name}` : ""}`}
        actions={
          canExport ? <ExportSicButton rows={exportRows} filename={`${sic.code}.xlsx`} label="Exportar a Excel" /> : undefined
        }
      />

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

      {/* Dos columnas en escritorio (contenido a la izquierda; estado, acciones y recorrido a la derecha).
          En celular se apila con el estado y las acciones primero. */}
      <div className={cn("mt-6 grid grid-cols-1 items-start gap-4", !stacked && "lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-6")}>
        <div className={cn("space-y-4 [&>*:empty]:hidden", !stacked && "lg:col-start-2 lg:row-start-1")}>
          <Card>
            <StatusBadge status={sic.status} />
            {needsMyApproval && (
              <p className="mt-3 text-sm text-slate-500">Esta SIC requiere tu aprobación para avanzar</p>
            )}
          </Card>
          <SicActions
            sicId={sic.id}
            status={sic.status}
            role={role}
            isRequester={isRequester}
            isAreaBoss={isAreaBoss}
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

        <div className={cn("space-y-4", !stacked && "lg:col-start-1 lg:row-span-2 lg:row-start-1")}>
          <Card className="flex flex-wrap gap-x-10 gap-y-5">
            <div>
              <p className={eyebrowClass}>Monto final</p>
              <p className={`${numClass} mt-0.5 text-3xl font-semibold tracking-tight text-slate-900`}>
                {formatAmount(sic.final_amount, sic.currency)}
              </p>
            </div>
            {(isCurrentAccount || isDirect) && (
              <div className="min-w-0">
                <p className={eyebrowClass}>Proveedor</p>
                <p className="mt-1.5 text-base font-medium text-slate-800 [overflow-wrap:anywhere]">{provider?.name ?? "-"}</p>
                <Badge tone={isDirect ? "sky" : "violet"} size="sm" className="mt-1.5">
                  {isDirect ? "Compra directa" : "Cuenta corriente"}
                </Badge>
              </div>
            )}
            <div>
              <p className={eyebrowClass}>Necesaria para</p>
              <p className={`${numClass} mt-1.5 text-base font-medium text-slate-800`}>
                {sic.needed_by_date ? formatSqlDate(sic.needed_by_date) : "-"}
              </p>
              {daysLeft !== null && (
                <p className={`mt-0.5 text-xs ${daysLeft < 0 ? "font-medium text-red-600" : "text-slate-500"}`}>{deadlineText(daysLeft)}</p>
              )}
            </div>
            <div>
              <p className={eyebrowClass}>Orden de compra</p>
              <p className={`${numClass} mt-1.5 text-base ${sic.po_number ? "font-medium text-slate-800" : "text-slate-500"}`}>
                {sic.po_number ?? "Sin emitir"}
              </p>
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden text-sm">
            <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Artículos solicitados</h2>
              <span className="text-xs text-slate-500">
                {(items ?? []).length} {(items ?? []).length === 1 ? "artículo" : "artículos"}
                {rejectedCount > 0 && ` · ${rejectedCount} ${rejectedCount === 1 ? "rechazado" : "rechazados"}`}
              </span>
            </div>
            <ul className="divide-y divide-slate-200">
              {(items ?? []).map((item, i) => {
                const itemFile = filesWithUrls.find((f) => f.item_id === item.id && f.file_type === "referencia");
                const itemCertFiles = filesWithUrls.filter(
                  (f) => f.item_id === item.id && f.file_type === "certificado_calidad"
                );
                const rejected = item.review_status === "rechazado";
                return (
                  <li key={item.id} className={`flex items-start gap-3 px-5 py-4 ${rejected ? "bg-red-50" : ""}`}>
                    <span className={`${numClass} mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium [overflow-wrap:anywhere] ${rejected ? "text-slate-400 line-through" : "text-slate-800"}`}>
                        {item.description}
                      </p>
                      {item.specs && <p className="mt-0.5 whitespace-pre-line text-slate-500 [overflow-wrap:anywhere]">{item.specs}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                        {rejected && (
                          <span className="rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700 [overflow-wrap:anywhere]">
                            Rechazado, no se compra{item.review_note ? `: ${item.review_note}` : ""}
                          </span>
                        )}
                        {!rejected && item.review_note && sic.status === "en_observacion" && (
                          <span className="rounded-lg bg-amber-100 px-2 py-0.5 font-medium text-amber-700 [overflow-wrap:anywhere]">
                            Observación: {item.review_note}
                          </span>
                        )}
                        {item.reference_link && (
                          <a href={item.reference_link} target="_blank" className="text-slate-900 underline">
                            Link de referencia
                          </a>
                        )}
                        {itemFile && <FilePreview url={itemFile.url} fileName={itemFile.file_name} />}
                      </div>
                      {item.requires_quality_cert && (
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                          <span className="font-medium text-slate-500">Certificado de calidad:</span>
                          {itemCertFiles.length === 0 ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Pendiente</span>
                          ) : (
                            itemCertFiles.map((f) => (
                              <FilePreview key={f.id} url={f.url} fileName={f.file_name} label="Ver" />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <p className={`${numClass} shrink-0 text-right font-medium ${rejected ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      × {item.quantity}
                      {!rejected && item.received_quantity > 0 && (
                        <span className="mt-0.5 block text-xs font-normal text-slate-400">
                          {item.received_quantity}/{item.quantity} recibido
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="text-sm">
            <h2 className="font-semibold text-slate-900">Archivos de la SIC</h2>
            {sicFiles.length === 0 ? (
              <EmptyState size="sm" className="mt-2" title="Todavía no hay archivos adjuntos." />
            ) : (
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sicFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                    <IconFileText className="h-5 w-5 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 [overflow-wrap:anywhere]">{f.file_name}</p>
                      <p className="text-xs text-slate-500">{FILE_TYPE_LABELS[f.file_type as SicFileType]}</p>
                    </div>
                    <span className="shrink-0 text-xs">
                      <FilePreview url={f.url} fileName={f.file_name} label="Ver" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className={cn("space-y-4", !stacked && "lg:col-start-2 lg:row-start-2")}>
          <Card className="text-sm">
            <h2 className="font-semibold text-slate-900">Recorrido de la SIC</h2>
            <ol className="mt-3">
              {events?.map((ev, i) => {
                const last = i === events.length - 1;
                return (
                  <li key={ev.id} className="relative pb-4 pl-5 last:pb-0">
                    {!last && <span aria-hidden="true" className="absolute -bottom-1 left-[3px] top-3 w-px bg-slate-200" />}
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${last ? "bg-indigo-600" : "bg-slate-400"}`}
                    />
                    <p className="font-medium text-slate-800">{STATUS_LABELS[ev.to_status]}</p>
                    <p className="text-xs text-slate-500">
                      {(ev.actor as { full_name: string | null } | null)?.full_name ?? "Sistema"} ·{" "}
                      <span className={numClass}>{formatDate(ev.created_at)}</span>
                    </p>
                    {ev.note && <p className="mt-1 whitespace-pre-line text-slate-500 [overflow-wrap:anywhere]">{ev.note}</p>}
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card className="text-sm">
            <h2 className="font-semibold text-slate-900">Datos</h2>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
              <dt className="text-slate-500">Solicitante</dt>
              <dd className="text-right text-slate-800 [overflow-wrap:anywhere]">{requesterName}</dd>
              <dt className="text-slate-500">Área</dt>
              <dd className="text-right text-slate-800 [overflow-wrap:anywhere]">{sic.department ?? "-"}</dd>
              {sic.on_behalf_of && (
                <>
                  <dt className="text-slate-500">En nombre de</dt>
                  <dd className="text-right text-slate-800 [overflow-wrap:anywhere]">{sic.on_behalf_of}</dd>
                </>
              )}
              <dt className="text-slate-500">Creada</dt>
              <dd className={`${numClass} text-right text-slate-800`}>{formatDate(sic.created_at)}</dd>
              <dt className="text-slate-500">Actualizada</dt>
              <dd className={`${numClass} text-right text-slate-800`}>{formatDate(sic.updated_at)}</dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
