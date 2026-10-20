import { createClient } from "@/lib/supabase/server";
import type { EmployeeWithPlant } from "@/lib/employees";

type Supabase = ReturnType<typeof createClient>;

const PAGE = 1000;

// PostgREST devuelve como mucho 1000 filas por consulta: se pide de a páginas hasta traer todo el padrón.
export async function fetchAllEmployees(supabase: Supabase): Promise<EmployeeWithPlant[]> {
  const out: EmployeeWithPlant[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("employees")
      .select("*, plant:plants(name, prefix)")
      .order("last_name")
      .order("first_name")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as EmployeeWithPlant[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

// Puestos y categorías ya cargados, para sugerirlos al escribir (texto libre, sin tablas maestras).
export async function fetchSuggestions(supabase: Supabase) {
  const { data } = await supabase.from("employees").select("position, job_category").limit(PAGE);
  const uniq = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b, "es"));
  return {
    positions: uniq((data ?? []).map((r) => r.position)),
    categories: uniq((data ?? []).map((r) => r.job_category)),
  };
}
