import type { Config } from "tailwindcss";

// Curvas compartidas: se usan en los tokens de transición y en las animaciones.
const OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)"; // acordeones y paneles que se despliegan
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// Colores por variables CSS (app/globals.css): el modo oscuro cambia las variables, no las clases.
// La escala `slate` es la escala NEUTRA de la app (texto, bordes, fondos); no es un azul grisáceo suelto.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name: string, shades: number[]) => Object.fromEntries(shades.map((s) => [s, v(`${name}-${s}`)]));
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
// Puente del rediseño B: estos nombres de Tailwind ya no tienen matiz propio y se leen como neutros (la tinta es slate-900).
// Se van reemplazando por tonos del sistema pantalla por pantalla; los alias se retiran al final.
const NEUTRAL_ALIAS = Object.fromEntries(
  Object.entries({ 50: 50, 100: 100, 200: 200, 300: 300, 400: 400, 500: 700, 600: 900, 700: 900, 800: 900, 900: 900 }).map(([k, n]) => [k, v(`slate-${n}`)])
);

const config: Config = {
  darkMode: "class",
  // `hover:` solo aplica en dispositivos con puntero: en táctil no queda el estado "pegado" tras tocar.
  future: { hoverOnlyWhenSupported: true },
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Radios de B: md 4 (detalles), lg 6 (controles), xl 8 (tarjetas), 2xl 16 (hoja y menú). Antes: 6, 8, 12, 16.
      borderRadius: { md: "4px", lg: "6px", xl: "8px", "2xl": "16px" },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        slate: scale("slate", [...SHADES, 950]),
        red: scale("red", SHADES),
        amber: scale("amber", SHADES),
        emerald: scale("emerald", SHADES),
        rose: scale("red", SHADES),
        orange: scale("amber", SHADES),
        indigo: NEUTRAL_ALIAS,
        violet: NEUTRAL_ALIAS,
        blue: NEUTRAL_ALIAS,
        sky: NEUTRAL_ALIAS,
        teal: NEUTRAL_ALIAS,
        // Marco y hoja del rediseño B, tinta y color de marca.
        frame: v("frame"),
        sheet: v("sheet"),
        ink: v("ink"),
        "on-ink": v("on-ink"),
        brand: v("brand"),
        "on-brand": v("on-brand"),
        scrim: v("scrim"),
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
      // Sin sombras en reposo: soft y lift quedan en `none` hasta retirar sus 3 usos (Card elevated, login). Solo flota lo que flota.
      boxShadow: {
        soft: "none",
        lift: "none",
        pop: "0 8px 24px -4px rgba(16, 26, 43, 0.18), 0 2px 6px rgba(16, 26, 43, 0.08)",
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
