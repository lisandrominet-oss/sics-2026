// Genera app/presentacion/_data/capturas.ts con las capturas de app/presentacion/_img/*.jpg embebidas en base64.
// Van dentro del código (y no en public/) para que solo se vean con la sesión iniciada: las imágenes de public/ son abiertas.
// Uso: node scripts/capturas-presentacion.js
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "app", "presentacion", "_img");
const out = path.join(__dirname, "..", "app", "presentacion", "_data", "capturas.ts");

let ts =
  "// Generado por scripts/capturas-presentacion.js a partir de app/presentacion/_img/*.jpg. No editar a mano.\n" +
  "// Capturas reales de la app con personas, correos, montos y proveedores tapados (ver la skill presentacion-a4).\n";
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".jpg")).sort()) {
  const clave = f.replace(/\.jpg$/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  ts += `export const ${clave} = "data:image/jpeg;base64,${fs.readFileSync(path.join(dir, f)).toString("base64")}";\n`;
}
fs.writeFileSync(out, ts);
console.log("Escrito", path.relative(process.cwd(), out), (ts.length / 1024).toFixed(0) + " KB");
