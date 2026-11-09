"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { BayDialog, GroupDialog, ProjectDialog } from "@/components/CalidadForms";
import { IconPlusCircle } from "@/components/icons";
import type { CalBay, CalProject, CalTemplate } from "@/lib/calidad";

// Botón «Nuevo proyecto» del listado.
export function CalidadNewProjectButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlusCircle className="h-4 w-4" />
        Nuevo proyecto
      </Button>
      <ProjectDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// Acciones de estructura del proyecto (solo editores): sector, grupo y datos del proyecto.
export function CalidadProjectBar({
  project, bay, templates,
}: { project: CalProject; bay: CalBay | null; templates: CalTemplate[] }) {
  const [dlg, setDlg] = useState<null | "project" | "newBay" | "editBay" | "newGroup">(null);
  const close = () => setDlg(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => setDlg("newBay")}>Nuevo sector</Button>
      {bay && (
        <>
          <Button size="sm" variant="secondary" onClick={() => setDlg("editBay")}>Editar sector</Button>
          <Button size="sm" variant="secondary" onClick={() => setDlg("newGroup")}>Nuevo grupo</Button>
        </>
      )}
      <Button size="sm" variant="ghost" onClick={() => setDlg("project")}>Editar proyecto</Button>

      <ProjectDialog open={dlg === "project"} onClose={close} project={project} />
      <BayDialog open={dlg === "newBay"} onClose={close} projectId={project.id} />
      {bay && (
        <>
          <BayDialog open={dlg === "editBay"} onClose={close} projectId={project.id} bay={bay} />
          <GroupDialog open={dlg === "newGroup"} onClose={close} bayId={bay.id} templates={templates} />
        </>
      )}
    </div>
  );
}
