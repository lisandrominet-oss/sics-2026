"use client";

import { useEffect, useState } from "react";

// Barra fija: marca, avance de lectura y botón para guardar el PDF (se oculta al imprimir).
// Va en px y no en rem: no escala con la hoja y se lee igual en cualquier pantalla.
export default function BarraSuperior({ total }: { total: number }) {
  const [actual, setActual] = useState(1);
  const [avance, setAvance] = useState(0);

  useEffect(() => {
    function onScroll() {
      const hojas = Array.from(document.querySelectorAll<HTMLElement>(".hoja"));
      const centro = window.innerHeight / 2;
      let idx = 0;
      hojas.forEach((h, i) => {
        if (h.getBoundingClientRect().top <= centro) idx = i;
      });
      setActual(idx + 1);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setAvance(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header className="pres-no-imprimir fixed inset-x-0 top-0 z-30 bg-slate-900 pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto flex h-[48px] max-w-[820px] items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <img src="/brand/isotipo-negativo.svg" alt="" className="h-6 w-auto" />
          <span className="text-[14px] font-semibold tracking-tight">SICS 2026</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] tabular-nums text-slate-300">
            {actual} / {total}
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="press rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white transition-colors duration-fast hover:bg-white/20"
          >
            Guardar PDF
          </button>
        </div>
      </div>
      <div className="h-[3px] bg-white/10" aria-hidden="true">
        <div className="h-full origin-left bg-indigo-400" style={{ transform: `scaleX(${avance})` }} />
      </div>
    </header>
  );
}
