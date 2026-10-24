"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Hace entrar un bloque (fade-up) la primera vez que aparece en pantalla.
// Sin IntersectionObserver o con movimiento reducido, se muestra de una (ver presentacion.css).
export default function Aparece({
  children,
  retardo = 0,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  /** Milisegundos de espera: sirve para escalonar los bloques de una misma hoja. */
  retardo?: number;
  className?: string;
  /** `li` cuando el bloque es un ítem de una lista (<ul>/<ol>), para no romper la semántica. */
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [visto, setVisto] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisto(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisto(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Etiqueta = as;
  return (
    <Etiqueta
      ref={ref}
      data-visto={visto || undefined}
      style={{ animationDelay: `${retardo}ms` }}
      className={`aparece ${visto ? "animate-fade-up" : ""} ${className}`}
    >
      {children}
    </Etiqueta>
  );
}
