"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import Button from "./Button";
import Modal from "./Modal";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta el botón de confirmar en rojo (acciones destructivas). */
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Reemplazo accesible de window.confirm(): `if (await confirm({ title: "…" })) { … }`
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>");
  return ctx;
}

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  // Últimas opciones mostradas: el diálogo sigue visible mientras dura la animación de salida.
  const lastOptions = useRef<ConfirmOptions | null>(null);
  if (options) lastOptions.current = options;
  const shown = options ?? lastOptions.current;

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={options !== null} onClose={() => close(false)} title={shown?.title ?? ""}>
        {shown?.description && <p className="mt-2 text-sm text-slate-600">{shown.description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            {shown?.cancelLabel ?? "Cancelar"}
          </Button>
          <Button variant={shown?.destructive ? "danger" : "primary"} onClick={() => close(true)}>
            {shown?.confirmLabel ?? "Confirmar"}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
