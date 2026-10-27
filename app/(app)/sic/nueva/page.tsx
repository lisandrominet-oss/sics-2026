import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import NuevaSicForm from "@/components/NuevaSicForm";
import { CAN_CREATE_SIC, effectiveRole } from "@/lib/constants";

export default async function NuevaSicPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (!CAN_CREATE_SIC.includes(role)) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: plants }, { data: projects }, { data: catalog }] = await Promise.all([
    supabase.from("plants").select("id, name, prefix").eq("active", true).order("name"),
    supabase.from("projects").select("id, name").eq("active", true).order("name"),
    // Sugerencias del campo Artículo: los más pedidos primero. Si el catálogo supera los mil, pasar a búsqueda en servidor.
    supabase.from("item_catalog").select("name").eq("active", true).order("uses_count", { ascending: false }).order("name").limit(1000),
  ]);

  const canPickPlant = role === "compras" || role === "admin";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Nueva solicitud interna de compra"
        description={
          role === "operativo" || role === "panol"
            ? "Completá los datos de tu solicitud. Primero la revisa el jefe de tu área y después pasa a Compras."
            : "Completá los datos de tu solicitud. Compras la va a revisar y buscar cotizaciones."
        }
      />
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <NuevaSicForm
          plants={plants ?? []}
          projects={projects ?? []}
          defaultPlantId={profile.plant_id}
          canPickPlant={canPickPlant}
          catalog={(catalog ?? []).map((c) => c.name)}
        />
        {/* Solo informa; mismo criterio que la descripción de arriba: operativo y pañol pasan primero por su jefe. */}
        <aside aria-labelledby="camino" className="hidden rounded-lg border border-slate-200 p-5 lg:sticky lg:top-16 lg:block">
          <h2 id="camino" className="text-base font-semibold text-slate-900">
            El recorrido de una SIC
          </h2>
          <ol className="mt-3 space-y-3 text-sm">
            {(role === "operativo" || role === "panol"
              ? [["Jefe de área", "Aprueba o pide una corrección."]]
              : []
            )
              .concat([
                ["Compras", "Revisa y cotiza."],
                ["Gerencia", "Aprueba si el monto supera el tope."],
                ["Pañol", "Recibe los bienes (los servicios, Compras)."],
              ])
              .map(([nombre, texto], i) => (
                <li key={nombre} className="flex gap-3">
                  <span aria-hidden="true" className={`mt-1 h-5 w-1.5 shrink-0 rounded-sm ${i === 0 ? "border border-ink/40 bg-brand dark:border-brand" : "bg-slate-200"}`} />
                  <div>
                    <p className="font-medium text-slate-900">{nombre}</p>
                    <p className="text-[13px] text-slate-500">{texto}</p>
                  </div>
                </li>
              ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
