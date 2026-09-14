"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SORT_OPTIONS } from "@/lib/constants";

export default function DashboardControls({
  defaultQuery,
  sort,
  dir,
}: {
  defaultQuery: string;
  sort: string;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (query !== defaultQuery) pushParams({ q: query || null });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[16rem] flex-1">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M20 20l-4.5-4.5" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por código o asunto…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
        />
      </div>

      <select
        value={sort}
        onChange={(e) => pushParams({ sort: e.target.value })}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Ordenar por: {opt.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => pushParams({ dir: dir === "asc" ? "desc" : "asc" })}
        title={dir === "asc" ? "Ascendente" : "Descendente"}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        {dir === "asc" ? "↑ Ascendente" : "↓ Descendente"}
      </button>
    </div>
  );
}
