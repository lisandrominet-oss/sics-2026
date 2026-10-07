export type ThemeChoice = "light" | "dark" | "auto";

export const THEME_STORAGE_KEY = "sc_theme";

export function getStoredTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "dark" || v === "auto" ? v : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  // Barra de estado del navegador móvil: sigue el tema de la app, no solo el del sistema (viewport en app/layout.tsx).
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", dark ? "#0b1220" : "#f8fafc"));
}

export function setStoredTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // sin almacenamiento disponible: el cambio vale solo para esta sesión
  }
  applyTheme(choice);
}

// Se ejecuta en el <head> antes del primer render para evitar el parpadeo de tema.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');}r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
