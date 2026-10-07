"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconX } from "@/components/icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// En celular se muestra como panel desde abajo (bottom-sheet) con scroll interno; desde 640 px, centrado.
// `variant="bare"`: sin panel ni título visible (visor de imágenes); `title` queda solo como nombre accesible.
// Para cambiar el ancho, pasar `className` con `sm:max-w-*`.
export default function Modal({
  open,
  onClose,
  title,
  children,
  className,
  variant = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  variant?: "dialog" | "bare";
}) {
  const bare = variant === "bare";
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // `onClose` suele llegar como función nueva en cada render: se lee desde un ref para no reiniciar el foco.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Foco inicial dentro del diálogo.
    // Se buscan en todo el overlay (no solo el panel) para incluir el botón de cerrar de la variante bare.
    const focusables = () => Array.from(overlayRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (focusables()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      // Foco atrapado: Tab circula solo entre los elementos del diálogo.
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-50 flex animate-fade-in justify-center backdrop-blur-sm",
        bare ? "items-center bg-black/70 p-4" : "items-end bg-slate-900/50 sm:items-center sm:p-4"
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "outline-none",
          bare
            ? "animate-scale-in"
            : "max-h-[90dvh] w-full animate-slide-up overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-pop sm:max-w-md sm:animate-scale-in sm:rounded-2xl sm:pb-6",
          className
        )}
      >
        <h2 id={titleId} className={bare ? "sr-only" : "text-base font-semibold text-slate-900"}>
          {title}
        </h2>
        {children}
      </div>
      {bare && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <IconX />
        </button>
      )}
    </div>,
    document.body
  );
}
