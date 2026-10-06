"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_START_EVENT } from "@/lib/navProgress";

// Barra fina arriba que avanza mientras carga la nueva pantalla y se completa al llegar.
export default function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const safety = useRef<ReturnType<typeof setTimeout>>();
  const hide = useRef<ReturnType<typeof setTimeout>>();
  const running = useRef(false);

  function start() {
    if (running.current) return;
    running.current = true;
    clearTimeout(hide.current);
    setVisible(true);
    setProgress(8);
    timer.current = setInterval(() => setProgress((p) => p + (90 - p) * 0.08), 200);
    // Red de seguridad: si la navegación no cambia la URL, la barra no queda colgada.
    safety.current = setTimeout(finish, 15000);
  }

  function finish() {
    if (!running.current) return;
    running.current = false;
    clearInterval(timer.current);
    clearTimeout(safety.current);
    setProgress(100);
    hide.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 260);
  }

  // La URL cambió: la nueva pantalla llegó.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAV_START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAV_START_EVENT, start);
      clearInterval(timer.current);
      clearTimeout(safety.current);
      clearTimeout(hide.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease-out" }}
    >
      <div
        className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.7)]"
        style={{ width: `${progress}%`, transition: "width 200ms ease-out" }}
      />
    </div>
  );
}
