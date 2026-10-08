import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  // `hover:` solo aplica en dispositivos con puntero: en táctil no queda el estado "pegado" tras tocar.
  future: { hoverOnlyWhenSupported: true },
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      // Menú lateral (siempre oscuro, no pasa por el parche de modo oscuro).
      colors: {
        sidebar: { fg: "#cbd5e1", muted: "#94a3b8", subtle: "#64748b", strong: "#f1f5f9", accent: "#818cf8" },
      },
      // Movimiento: curvas y duraciones compartidas para que toda la app se sienta igual.
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px -2px rgba(15, 23, 42, 0.06)",
        lift: "0 2px 4px rgba(15, 23, 42, 0.05), 0 12px 24px -6px rgba(15, 23, 42, 0.12)",
        pop: "0 8px 16px -4px rgba(15, 23, 42, 0.12), 0 24px 48px -12px rgba(15, 23, 42, 0.25)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96) translateY(4px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-4px)" },
          "40%, 80%": { transform: "translateX(4px)" },
        },
        "check-pop": {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out both",
        "fade-up": "fade-up 320ms cubic-bezier(0.16, 1, 0.3, 1) both",
        // Igual que fade-up pero sin dejar `transform` aplicado al terminar (importa si adentro hay elementos `fixed`).
        enter: "fade-up 360ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        "scale-in": "scale-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-down": "slide-down 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-up": "slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.6s linear infinite",
        shake: "shake 360ms ease-in-out",
        "check-pop": "check-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "soft-pulse": "soft-pulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
