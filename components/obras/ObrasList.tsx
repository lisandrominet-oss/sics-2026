"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import ImportObraModal from "@/components/obras/ImportObraModal";
import { IconUpload } from "@/components/icons";
import { formatDate } from "@/lib/constants";
import { numClass } from "@/lib/ui";
import { cn } from "@/lib/cn";

export type ObraRow = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  importedAt: string | null;
  nodeCount: number;
};

export default function ObrasList({ rows, canEdit }: { rows: ObraRow[]; canEdit: boolean }) {
  const [importOpen, setImportOpen] = useState(false);
  const withPlan = rows.filter((r) => r.nodeCount > 0);
  const withoutPlan = rows.filter((r) => r.nodeCount === 0 && r.active);

  return (
    <div className="mt-6">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setImportOpen(true)}>
            <IconUpload className="h-4 w-4" />
            Importar desde Primavera
          </Button>
        </div>
      )}

      {withPlan.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Todavía no hay obras con plan"
          description={
            canEdit
              ? "Importá el proyecto desde Primavera para que las SIC se puedan clasificar por ítem de obra."
              : "Ingeniería carga el plan de cada obra desde Primavera."
          }
        />
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
          {withPlan.map((r) => (
            <li key={r.id}>
              <Link href={`/obras/${r.id}`} className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900 [overflow-wrap:anywhere]">{r.name}</span>
                  <span className={cn("block text-xs text-slate-500", numClass)}>
                    {[r.code, `${r.nodeCount} ítems`, r.importedAt && `importada el ${formatDate(r.importedAt)}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {!r.active && <Badge tone="muted">Inactivo</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {withoutPlan.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-slate-900">Proyectos sin plan</h2>
          <p className="mt-0.5 text-xs text-slate-500">Sus SIC se cargan sin ítem de obra.{canEdit && " Se les puede importar el plan."}</p>
          <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {withoutPlan.map((r) => (
              <li key={r.id}>
                <Link href={`/obras/${r.id}`} className="flex min-h-11 items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ImportObraModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectsWithoutPlan={withoutPlan.map((r) => ({ id: r.id, name: r.name, code: r.code }))}
      />
    </div>
  );
}
