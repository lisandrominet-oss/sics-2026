"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

// Toaster de la app. Sigue el tema (clase `dark` en <html>), incluida la opción "Automático".
export default function AppToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobile, setMobile] = useState(false);

  // Celular (< 640 px): avisos arriba y centrados, debajo de la barra superior y respetando la zona segura del notch.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      theme={theme}
      position={mobile ? "top-center" : "bottom-right"}
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 64px)", left: 12, right: 12 }}
      richColors
      closeButton
      visibleToasts={mobile ? 3 : 4}
      toastOptions={{ classNames: { toast: "font-sans" } }}
    />
  );
}
