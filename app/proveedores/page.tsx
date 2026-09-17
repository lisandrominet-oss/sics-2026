import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import ProvidersManager from "@/components/ProvidersManager";
import { effectiveRole } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProveedoresPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role !== "compras" && role !== "admin") redirect("/dashboard");

  const supabase = createClient();

  const [
    { data: categories },
    { data: providers },
    { data: categoryLinks },
    { data: comments },
    { data: files },
  ] = await Promise.all([
    supabase.from("provider_categories").select("*").order("name"),
    supabase.from("providers").select("*").order("name"),
    supabase.from("provider_category_links").select("*"),
    supabase
      .from("provider_comments")
      .select("*, author:profiles(full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("provider_files").select("*").order("created_at", { ascending: false }),
  ]);

  const filesWithUrls = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await supabase.storage.from("provider-files").createSignedUrl(f.storage_path, 300);
      return { ...f, url: data?.signedUrl ?? null };
    })
  );

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Compras</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Proveedores</h1>
        <p className="mt-2 text-sm text-slate-500">
          Tu agenda de proveedores: contacto, forma de pago, comentarios y documentos, organizados por
          rubro.
        </p>
        <div className="mt-6">
          <ProvidersManager
            categories={categories ?? []}
            providers={providers ?? []}
            categoryLinks={categoryLinks ?? []}
            comments={comments ?? []}
            files={filesWithUrls}
            currentUserId={profile.id}
          />
        </div>
      </div>
    </AppShell>
  );
}
