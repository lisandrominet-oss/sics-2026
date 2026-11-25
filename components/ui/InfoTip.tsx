"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconInfo } from "@/components/icons";

// Ícono (i) que muestra una aclaración al tocarlo. Reemplaza los textos de ayuda que ocupaban lugar en pantalla:
// la interfaz queda limpia y la explicación sigue a un toque. Se abre con clic o toque (no con hover, así anda en celular)
// y se cierra con Escape, tocando afuera o tocando de nuevo el ícono.
export default function InfoTip({
  children,
  label = "Más información",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Escape cierra solo el globo: se escucha en captura sobre `window` y se frena acá,
        // así no llega al Modal (que escucha en `document`) cuando el (i) está dentro de un diálogo.
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  function toggle() {
    if (!open && buttonRef.current) {
      // Si el ícono está sobre el borde derecho, el globo se abre hacia la izquierda para no salirse de la pantalla.
      const rect = buttonRef.current.getBoundingClientRect();
      setAlignRight(rect.left + 300 > window.innerWidth);
    }
    setOpen((v) => !v);
  }

  return (
    <span ref={rootRef} className={cn("relative inline-flex align-middle", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        className={cn(
          "press -m-1.5 inline-flex items-center justify-center rounded-full p-1.5 text-slate-400 max-sm:-m-3.5 max-sm:p-3.5 transition-colors duration-fast hover:text-slate-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          open && "text-slate-700"
        )}
      >
        <IconInfo className="h-4 w-4" />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className={cn(
            "absolute top-full z-30 mt-2 block w-max max-w-[min(34ch,calc(100vw-2rem))] animate-slide-down rounded-lg border border-slate-200 bg-sheet px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-700 shadow-pop",
            alignRight ? "right-0" : "left-0"
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
