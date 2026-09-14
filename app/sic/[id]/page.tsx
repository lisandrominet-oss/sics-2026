import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import SicActions from "@/components/SicActions";
import { IconArrowLeft } from "@/components/icons";
import {
  FILE_TYPE_LABELS,
  STATUS_LABELS,
  effectiveRole,
  formatAmount,
  formatDate,
  type SicFileType,
} from "@/lib/constants";
import { getPendingSicsCount } from "@/lib/pendingSics";

export default async function SicDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;

  const supabase = createClient();

  const { data: sic } = await supabase
    .from("sics")
    .select("*, plants(name, prefix), project:projects(id, name), requester:profiles(full_name, email, department)")
    .eq("id", params.id)
    .maybeSingle();

  if (!sic) notFound();

  const [{ data: events }, { data: files }, { data: items }, { data: projects }, pendingCount] =
    await Promise.all([
      supabase
        .from("sic_events")
        .select("*, actor:profiles(full_name)")
        .eq("sic_id", params.id)
        .order("created_at", { ascending: true }),
      supabase.from("sic_files").select("*").eq("sic_id", params.id).order("created_at", { ascending: true }),
      supabase.from("sic_items").select("*").eq("sic_id", params.id).order("position", { ascending: true }),
      supabase.from("projects").select("id, name").eq("active", true).order("name"),
      getPendingSicsCount(supabase, role, profile.id),
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

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
      pendingCount={pendingCount}
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
          <StatusBadge status={sic.status} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          <Info label="Planta" value={plant ? `${plant.name} (${plant.prefix})` : "-"} />
          <Info label="Proyecto" value={project?.name ?? "-"} />
          <Info label="Solicitante" value={requester?.full_name ?? requester?.email ?? "-"} />
          <Info label="Área / Departamento" value={sic.department ?? "-"} />
          <Info label="Necesaria para" value={sic.needed_by_date ? formatDate(sic.needed_by_date) : "-"} />
          <Info label="Creada" value={formatDate(sic.created_at)} />
          <Info label="Monto final" value={formatAmount(sic.final_amount, sic.currency)} />
          <Info label="Orden de compra" value={sic.po_number ?? "-"} />
          <Info label="Última actualización" value={formatDate(sic.updated_at)} />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-semibold text-slate-900">Artículos solicitados</h2>
          <div className="mt-3 space-y-3">
            {(items ?? []).map((item, i) => {
              const itemFile = filesWithUrls.find((f) => f.item_id === item.id);
              return (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-medium text-slate-800">
                    {i + 1}. {item.description} — {item.quantity}
                    {item.received_quantity > 0 && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        ({item.received_quantity}/{item.quantity} recibido)
                      </span>
                    )}
                  </p>
                  {item.specs && <p className="mt-1 text-slate-500">{item.specs}</p>}
                  <div className="mt-1 flex gap-3 text-xs">
                    {item.reference_link && (
                      <a href={item.reference_link} target="_blank" className="text-slate-900 underline">
                        Link de referencia
                      </a>
                    )}
                    {itemFile?.url && (
                      <a href={itemFile.url} target="_blank" className="text-slate-900 underline">
                        {itemFile.file_name}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-semibold text-slate-900">Archivos de la SIC</h2>
          {filesWithUrls.filter((f) => !f.item_id).length === 0 ? (
            <p className="mt-2 text-slate-400">Todavía no hay archivos adjuntos.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {filesWithUrls
                .filter((f) => !f.item_id)
                .map((f) => (
                  <li key={f.id} className="flex items-center justify-between">
                    <span className="text-slate-600">
                      {FILE_TYPE_LABELS[f.file_type as SicFileType]}: {f.file_name}
                    </span>
                    {f.url && (
                      <a href={f.url} target="_blank" className="text-slate-900 underline">
                        Descargar
                      </a>
                    )}
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
              items: (items ?? []).map((it) => ({
                id: it.id,
                description: it.description,
                quantity: it.quantity,
                receivedQuantity: it.received_quantity,
                specs: it.specs,
                referenceLink: it.reference_link,
                existingFileName: filesWithUrls.find((f) => f.item_id === it.id)?.file_name ?? null,
              })),
            }}
            projects={projects ?? []}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="text-slate-700">{value}</p>
    </div>
  );
}
