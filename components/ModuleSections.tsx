"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowRight } from "@/components/icons";

export default function ModuleSections({ sections }: { sections: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!selected) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setSelected(name)}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <span className="text-sm font-semibold text-slate-900">{name}</span>
            <IconArrowRight className="h-4 w-4 text-slate-400" />
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selected}: módulo en construcción`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm animate-scale-in rounded-2xl bg-white p-8 text-center shadow-xl"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{selected}</p>
            <p className="mt-4 text-5xl" aria-hidden="true">
              😊
            </p>
            <p className="mt-4 text-lg font-semibold text-slate-900">Módulo en construcción</p>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setSelected(null)}
              className="mt-6 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
