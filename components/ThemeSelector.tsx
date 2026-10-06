"use client";

import { useEffect, useState } from "react";
import { IconMonitor, IconMoon, IconSun } from "@/components/icons";
import { getStoredTheme, setStoredTheme, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; hint: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Claro", hint: "Fondo claro", icon: <IconSun /> },
  { value: "dark", label: "Oscuro", hint: "Fondo oscuro", icon: <IconMoon /> },
  { value: "auto", label: "Automático", hint: "Sigue a tu dispositivo", icon: <IconMonitor /> },
];

export default function ThemeSelector() {
  const [theme, setTheme] = useState<ThemeChoice>("light");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function choose(value: ThemeChoice) {
    setTheme(value);
    setStoredTheme(value);
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(o.value)}
            className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
              active
                ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              {o.icon}
              {o.label}
            </span>
            <span className="text-xs text-slate-500">{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
