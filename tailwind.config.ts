import type { Config } from "tailwindcss";

// Curvas compartidas: se usan en los tokens de transición y en las animaciones.
const OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)"; // acordeones y paneles que se despliegan
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

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
        sidebar: { fg: "#cbd5e1", muted: "#94a3b8", subtle: "#7c8ba1", strong: "#f1f5f9", accent: "#818cf8" },
      },
      // Movimiento: curvas y duraciones compartidas para que toda la app se sienta igual.
      transitionTimingFunction: {
        "out-expo": OUT_EXPO,
        drawer: DRAWER,
        spring: SPRING,
      },
      // `open` > `close`: lo que se despliega tarda un poco más que lo que se repliega.
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        open: "240ms",
        close: "160ms",
        slow: "320ms",
      },
      // `transition-colors` también transiciona `scale` para no cancelar la presión de los botones (globals.css).
      transitionProperty: {
        colors: "color, background-color, border-color, text-decoration-color, fill, stroke, scale",
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
        // Entrada de página: solo opacidad (se ve decenas de veces al día; puente suave esqueleto → contenido).
        "page-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        // Filas de listas del Tablero: apenas suben 4 px, con escalonado corto desde el componente.
        "row-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        // Salidas de las superposiciones: más cortas que las entradas (140-180 ms contra 200-280 ms).
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "scale-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.97)" },
        },
        "sheet-out": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Solo `transform`: el brillo corre por la compositora, sin repintar el bloque.
        shimmer: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(100%)" },
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
        "fade-up": `fade-up 320ms ${OUT_EXPO} both`,
        // Igual que fade-up pero sin dejar `transform` aplicado al terminar (importa si adentro hay elementos `fixed`).
        enter: `fade-up 360ms ${OUT_EXPO} backwards`,
        "scale-in": `scale-in 220ms ${OUT_EXPO} both`,
        "page-in": "page-in 160ms ease-out backwards",
        "row-in": `row-in 200ms ${OUT_EXPO} backwards`,
        "slide-down": `slide-down 200ms ${OUT_EXPO} both`,
        "slide-up": `slide-up 280ms ${OUT_EXPO} both`,
        "fade-out": "fade-out 140ms ease-out both",
        "scale-out": "scale-out 140ms ease-out both",
        "sheet-out": `sheet-out 180ms ${OUT_EXPO} both`,
        shimmer: "shimmer 1.6s linear infinite",
        shake: "shake 360ms ease-in-out",
        "check-pop": `check-pop 320ms ${SPRING} both`,
        "soft-pulse": "soft-pulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
