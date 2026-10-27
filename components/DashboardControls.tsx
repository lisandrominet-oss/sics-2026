"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { sortOptionsFor, type UserRole } from "@/lib/constants";
import { startNavProgress } from "@/lib/navProgress";
import { IconSearch } from "@/components/icons";
import Button from "@/components/ui/Button";

export default function DashboardControls({
  defaultQuery,
  sort,
  dir,
  role,
}: {
  defaultQuery: string;
  sort: string;
  dir: "asc" | "desc";
  role: UserRole;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  // Último texto que este mismo componente mandó a la URL: distingue "volvió el servidor con lo que escribí"
  // de "la URL cambió por otro lado" (pestaña de filtro, botón Atrás), caso en que el input se resincroniza.
  const lastPushedRef = useRef(defaultQuery);

  useEffect(() => {
    if (defaultQuery !== lastPushedRef.current) {
      lastPushedRef.current = defaultQuery;
      setQuery(defaultQuery);
    }
  }, [defaultQuery]);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    startNavProgress();
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (query !== defaultQuery) {
        lastPushedRef.current = query;
        pushParams({ q: query || null });
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[min(16rem,100%)] flex-1">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por código, asunto o artículo…"
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-sheet py-1.5 pl-9 pr-3 text-sm sm:min-h-8"
        />
      </div>

      <select
        value={sort}
        onChange={(e) => pushParams({ sort: e.target.value })}
        className="min-h-11 rounded-lg border border-slate-300 bg-sheet px-3 py-1.5 text-sm text-slate-700 sm:min-h-8"
      >
        {sortOptionsFor(role).map((opt) => (
          <option key={opt.value} value={opt.value}>
            Ordenar por: {opt.label}
          </option>
        ))}
      </select>

      <Button
        variant="secondary"
        onClick={() => pushParams({ dir: dir === "asc" ? "desc" : "asc" })}
        title={dir === "asc" ? "Ascendente" : "Descendente"}
      >
        {dir === "asc" ? "↑ Ascendente" : "↓ Descendente"}
      </Button>
    </div>
  );
}
