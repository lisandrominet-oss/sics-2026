"use client";

import { useState } from "react";
import Button from "./Button";
import Field from "./Field";
import Modal from "./Modal";
import { inputClass } from "@/lib/ui";

export type PromptField = {
  name: string;
  label: string;
  /** Texto de ayuda debajo del campo. */
  hint?: string;
  placeholder?: string;
  required?: boolean;
  /** Teclado numérico en el celular (no restringe lo que se puede escribir). */
  inputMode?: "text" | "decimal";
  /** Devuelve el mensaje de error, o null si el valor es válido. Se llama solo con valores no vacíos. */
  validate?: (value: string) => string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fields: PromptField[];
  confirmLabel?: string;
  /** Pinta el botón de confirmar en rojo (acciones destructivas). */
  destructive?: boolean;
  /**
   * Se llama con los valores ya validados (texto recortado). El diálogo se cierra cuando termina,
   * salvo que devuelva `false` (falló): queda abierto con lo que se escribió para poder reintentar.
   */
  onSubmit: (values: Record<string, string>) => Promise<boolean | void> | boolean | void;
};

// Reemplazo accesible de window.prompt(): uno o más campos de texto con validación, dentro de un Modal.
export default function PromptDialog({ open, onClose, title, description, ...rest }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    // Mientras se envía no se puede cerrar (Escape o click afuera): evita perder el resultado.
    <Modal open={open} onClose={() => !busy && onClose()} title={title}>
      {/* El formulario solo existe con el diálogo abierto (y durante su salida): al reabrir arranca vacío y sin errores. */}
      <PromptForm description={description} onClose={onClose} busy={busy} setBusy={setBusy} {...rest} />
    </Modal>
  );
}

function PromptForm({
  description,
  fields,
  confirmLabel = "Confirmar",
  destructive = false,
  onSubmit,
  onClose,
  busy,
  setBusy,
}: Omit<Props, "open" | "title"> & { onClose: () => void; busy: boolean; setBusy: (busy: boolean) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, ""])));
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed: Record<string, string> = {};
    const found: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.name] ?? "").trim();
      trimmed[f.name] = v;
      if (!v) {
        if (f.required) found[f.name] = "Este dato es obligatorio.";
        continue;
      }
      const msg = f.validate?.(v);
      if (msg) found[f.name] = msg;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    let ok: boolean | void = false;
    try {
      ok = await onSubmit(trimmed);
    } finally {
      setBusy(false);
    }
    if (ok !== false) onClose();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
      <div className="mt-4 space-y-3">
        {fields.map((f) => (
          <Field key={f.name} label={f.label} hint={f.hint} error={errors[f.name]}>
            {(props) => (
              <input
                {...props}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                placeholder={f.placeholder}
                inputMode={f.inputMode}
                autoComplete="off"
                className={inputClass}
              />
            )}
          </Field>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" variant={destructive ? "danger" : "primary"} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
