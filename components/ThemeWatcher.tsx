"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY, applyTheme, getStoredTheme } from "@/lib/theme";

// Mantiene el tema al día: sigue al sistema cuando la opción es "Automático" y
// se sincroniza entre pestañas.
export default function ThemeWatcher() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (getStoredTheme() === "auto") applyTheme("auto");
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) applyTheme(getStoredTheme());
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
