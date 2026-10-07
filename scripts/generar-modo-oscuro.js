// Genera app/dark-theme.css: reglas ".dark ..." para las clases de color de Tailwind realmente usadas.
// Uso (desde la raíz):  node scripts/generar-modo-oscuro.js
// Volver a correrlo si se agregan clases de color nuevas (fondos, textos o bordes).
const fs = require("fs");
const path = require("path");
const colors = require("tailwindcss/colors");

const ROOTS = ["app", "components", "lib"];
const HANDLED_VARIANTS = { hover: ":hover", disabled: ":disabled", focus: ":focus" };

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f.name) && !f.name.endsWith(".d.ts") && f.name !== "database.types.ts") out.push(p);
  }
  return out;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (h, a) => `rgba(${hex(h).join(", ")}, ${a})`;
const withAlpha = (value, alpha) => {
  if (alpha == null) return value;
  if (value.startsWith("#")) return rgba(value, alpha / 100);
  const m = value.match(/^rgba\((.+), ([\d.]+)\)$/);
  return m ? `rgba(${m[1]}, ${(parseFloat(m[2]) * alpha / 100).toFixed(3)})` : value;
};

// ---- Neutros (slate): superficie, hover, texto, borde
const SLATE = {
  bg: { white: "#131c2f", 50: "#0b1220", 100: "#1a2438", 200: "#263248", 300: "#334155" },
  bgHover: { white: "#18233a", 50: "#18233a", 100: "#1f2b42" },
  bgDisabled: { 50: "#0e1626", 100: "#0e1626" },
  text: { 900: "#f1f5f9", 800: "#e2e8f0", 700: "#cbd5e1", 600: "#b0bccd", 500: "#94a3b8", 400: "#7d8ba1", 300: "#64748b" },
  textHover: { 900: "#f8fafc", 800: "#f1f5f9", 700: "#e2e8f0" },
  textDisabled: { 400: "#64748b" },
  border: { 50: "#172033", 100: "#1c2639", 200: "#2a364c", 300: "#3a475e", 400: "#4b5a73", 900: "#cbd5e1" },
};

// ---- Colores con matiz: tintes translúcidos de fondo, textos más claros, bordes translúcidos
const TINT_BG = { 50: 0.1, 100: 0.16, 200: 0.22, 300: 0.3 };
const TINT_BORDER = { 50: 0.12, 100: 0.2, 200: 0.3, 300: 0.4 };
const TEXT_SHIFT = { 900: 100, 800: 200, 700: 300, 600: 400, 500: 400 };

function darkValue(prop, color, shade, variant) {
  if (color === "white") {
    if (prop === "bg") return variant === "hover" ? SLATE.bgHover.white : SLATE.bg.white;
    return null;
  }
  if (color === "black") return null;
  if (color === "slate") {
    if (prop === "bg") {
      if (variant === "hover") return SLATE.bgHover[shade] ?? null;
      if (variant === "disabled") return SLATE.bgDisabled[shade] ?? null;
      return SLATE.bg[shade] ?? null;
    }
    if (prop === "text") {
      if (variant === "hover") return SLATE.textHover[shade] ?? null;
      if (variant === "disabled") return SLATE.textDisabled[shade] ?? null;
      return SLATE.text[shade] ?? null;
    }
    if (prop === "border" || prop === "divide") return SLATE.border[shade] ?? null;
    return null;
  }
  const palette = colors[color];
  if (!palette) return null;
  if (prop === "bg") return TINT_BG[shade] != null ? rgba(palette[500], variant === "hover" ? TINT_BG[shade] * 1.4 : TINT_BG[shade]) : null;
  if (prop === "text") return TEXT_SHIFT[shade] ? palette[TEXT_SHIFT[shade]] : null;
  if (prop === "border" || prop === "divide") return TINT_BORDER[shade] != null ? rgba(palette[500], TINT_BORDER[shade]) : null;
  return null;
}

const TOKEN =
  /(?<![\w\-:\/\[])((?:[a-z\-]+:)*)(bg|text|border|divide)-(white|black|(?:[a-z]+)-\d{2,3})(?:\/(\d+))?(?![\w\-])/g;

const found = new Map();
const skipped = new Set();
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(TOKEN)) {
      const [full, variants, prop, col, alpha] = m;
      const vs = variants.split(":").filter(Boolean);
      if (vs.some((v) => !HANDLED_VARIANTS[v])) { skipped.add(full); continue; }
      if (vs.length > 1) { skipped.add(full); continue; }
      found.set(full, { full, variant: vs[0] ?? null, prop, col, alpha: alpha ? Number(alpha) : null });
    }
  }
}

const esc = (s) => s.replace(/[:\/.]/g, "\\$&");
const rules = [];
for (const t of [...found.values()].sort((a, b) => a.full.localeCompare(b.full))) {
  let color = t.col, shade = null;
  if (t.col !== "white" && t.col !== "black") { [color, shade] = [t.col.split("-")[0], Number(t.col.split("-")[1])]; }
  if ((color === "white" || color === "black") && t.alpha != null) continue; // superposiciones blancas/negras: no cambian
  let value = darkValue(t.prop, color, shade, t.variant);
  if (!value) continue;
  value = withAlpha(value, t.alpha);
  const decl = t.prop === "bg" ? "background-color" : t.prop === "text" ? "color" : "border-color";
  const cls = "." + esc(t.full);
  const pseudo = t.variant ? HANDLED_VARIANTS[t.variant] : "";
  let sel = `.dark ${cls}${pseudo}`;
  if (t.prop === "divide") sel = `.dark ${cls} > :not([hidden]) ~ :not([hidden])`;
  // Tailwind (hoverOnlyWhenSupported) emite los hover dentro de @media (hover: hover); el parche oscuro igual, para que no se "peguen" en táctil.
  const rule = `${sel} { ${decl}: ${value}; }`;
  rules.push(t.variant === "hover" ? `@media (hover: hover) { ${rule} }` : rule);
}

const base = `/* Generado por scripts/generar-modo-oscuro.js — no editar a mano. */
.dark { color-scheme: dark; }
.dark body { background-color: #0b1220; color: #e2e8f0; }
.dark :where(input, select, textarea) { background-color: #0e1626; color: #e2e8f0; }
.dark :where(input, textarea)::placeholder { color: #64748b; }
`;
fs.writeFileSync("app/dark-theme.css", base + rules.join("\n") + "\n");
console.log(`Reglas generadas: ${rules.length}`);
if (skipped.size) console.log("Sin cubrir (variantes no manejadas):", [...skipped].join(", "));
