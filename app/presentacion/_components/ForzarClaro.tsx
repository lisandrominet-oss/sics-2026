"use client";

import { useEffect } from "react";
import { applyTheme, getStoredTheme } from "@/lib/theme";

// La presentación es una hoja de papel: siempre en claro, aunque el usuario tenga el modo oscuro.
// ThemeWatcher (layout raíz) puede volver a poner `dark` si cambia el tema del sistema o de otra pestaña,
// así que se vigila la clase mientras la presentación está abierta. Al salir devuelve el tema guardado.
export default function ForzarClaro() {
  useEffect(() => {
    const root = document.documentElement;
    const forzar = () => {
      if (root.classList.contains("dark")) root.classList.remove("dark");
      root.style.colorScheme = "light";
    };
    forzar();
    root.classList.add("presentacion");
    const observer = new MutationObserver(forzar);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      root.classList.remove("presentacion");
      applyTheme(getStoredTheme());
    };
  }, []);
  return null;
}
