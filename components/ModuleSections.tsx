"use client";

import { useState } from "react";
import { IconArrowRight } from "@/components/icons";
import Modal from "@/components/ui/Modal";
import { eyebrowClass } from "@/lib/ui";

export default function ModuleSections({ sections }: { sections: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setSelected(name)}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <span className="text-sm font-semibold text-slate-900">{name}</span>
            <IconArrowRight className="h-4 w-4 text-slate-400" />
          </button>
        ))}
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Módulo en construcción"
        className="text-center sm:max-w-sm sm:p-8"
      >
        <p className={`${eyebrowClass} mt-2`}>{selected}</p>
        <p className="mt-4 text-5xl" aria-hidden="true">
          😊
        </p>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mt-6 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Cerrar
        </button>
      </Modal>
    </>
  );
}
