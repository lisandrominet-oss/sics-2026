"use client";

import { useEffect, useRef, useState } from "react";

// Muestra el valor ya al montar; cuando cambia, cuenta desde lo que se veía hasta el nuevo (300 ms).
// Con movimiento reducido, muestra el valor directo.
export default function AnimatedNumber({ value, duration = 300 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  // Último valor que se llegó a mostrar: si el valor cambia a mitad de una cuenta, sigue desde ahí.
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      from.current = value;
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - t0) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(start + (value - start) * eased);
      from.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{shown.toLocaleString("es-AR")}</span>;
}
