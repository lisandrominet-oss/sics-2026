import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { CAN_CREATE_SIC, effectiveRole, type SicStatus } from "@/lib/constants";
import { OBRA_NODE_COLUMNS, type ObraAccess, type ObraNode } from "@/lib/obras";
import ObraDetail, { type ObraChange, type ObraSic } from "@/components/obras/ObraDetail";
import { IconArrowLeft } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// PostgREST entrega como mucho 1000 filas por pedido: un plan grande se trae por partes.
const PAGE = 1000;

export default async function ObraPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;

  const supabase = createClient();
  const { data: access } = await supabase.rpc("obras_access");
  if (!access) redirect("/dashboard");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, code, active, source, imported_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const nodes: ObraNode[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("project_nodes")
      .select(OBRA_NODE_COLUMNS)
      .eq("project_id", params.id)
      .order("position")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    nodes.push(...((data ?? []) as ObraNode[]));
    if (!data || data.length < PAGE) break;
  }

  // Solo las SIC que este usuario puede ver (la base filtra por rol y área).
  const sics: ObraSic[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("sics")
      .select("id, code, subject, status, needed_by_date, project_node_id")
      .eq("project_id", params.id)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    sics.push(...(data ?? []).map((s) => ({ ...s, status: s.status as SicStatus })));
    if (!data || data.length < PAGE) break;
  }

  const { data: changes } = await supabase
    .from("project_node_changes")
    .select("id, node_id, change_type, origin, old_start, old_end, new_start, new_end, detail, reason, created_at, actor:profiles(full_name)")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/obras" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 lg:min-h-0">
        <IconArrowLeft />
        Obras
      </Link>
      <ObraDetail
        project={project}
        nodes={nodes}
        sics={sics}
        changes={(changes ?? []).map((c) => ({
          ...c,
          actorName: (c.actor as unknown as { full_name: string | null } | null)?.full_name ?? null,
        })) as ObraChange[]}
        canEdit={(access as ObraAccess) === "editar"}
        canCreateSic={CAN_CREATE_SIC.includes(role)}
      />
    </div>
  );
}
