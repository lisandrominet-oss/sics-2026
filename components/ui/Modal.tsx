"use client";

import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconX } from "@/components/icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// En celular se muestra como panel desde abajo (bottom-sheet) con scroll interno; desde 640 px, centrado.
// `variant="bare"`: sin panel ni título visible (visor de imágenes); `title` queda solo como nombre accesible.
// Para cambiar el ancho, pasar `className` con `sm:max-w-*`.
// Al cerrar, el panel sigue montado mientras dura la salida (140-180 ms, más corta que la entrada) y después se desmonta.
// Quien lo usa debe conservar el contenido durante ese lapso (ver ConfirmProvider y ModuleSections).
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
  const [mounted, setMounted] = useState(open);
  const closing = mounted && !open;
  // Si se reabre mientras todavía sale, el contenido se vuelve a montar: no conserva lo que había escrito antes.
  const wasOpen = useRef(open);
  const generation = useRef(0);
  if (open && !wasOpen.current && mounted) generation.current += 1;
  wasOpen.current = open;
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

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    // Red de seguridad: si `animationend` no llega (pestaña oculta, estilos sin cargar), igual se desmonta.
    const t = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  if ((!open && !mounted) || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-50 flex justify-center backdrop-blur-sm",
        closing ? "pointer-events-none animate-fade-out" : "animate-fade-in",
        bare ? "items-center bg-black/70 p-4" : "items-end bg-slate-900/50 sm:items-center sm:p-4"
      )}
      aria-hidden={closing || undefined}
      // `inert` mientras sale: sin foco, Tab ni toques en un diálogo que ya se está yendo (evita un segundo envío).
      {...(closing ? ({ inert: "" } as Record<string, string>) : {})}
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
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) setMounted(false);
        }}
        className={cn(
          "outline-none",
          bare
            ? closing
              ? "animate-scale-out"
              : "animate-scale-in"
            : "max-h-[90dvh] w-full overflow-y-auto overscroll-contain [overflow-wrap:anywhere] rounded-t-2xl border border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-pop sm:max-w-md sm:rounded-2xl sm:pb-6",
          !bare && (closing ? "animate-sheet-out sm:animate-scale-out" : "animate-slide-up sm:animate-scale-in"),
          className
        )}
      >
        <Fragment key={generation.current}>
          <h2 id={titleId} className={bare ? "sr-only" : "text-base font-semibold text-slate-900"}>
            {title}
          </h2>
          {children}
        </Fragment>
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
