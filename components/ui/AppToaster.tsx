"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

// Toaster de la app. Sigue el tema (clase `dark` en <html>), incluida la opción "Automático".
export default function AppToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

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
      position="bottom-right"
      richColors
      closeButton
      visibleToasts={4}
      toastOptions={{ classNames: { toast: "font-sans" } }}
    />
  );
}
