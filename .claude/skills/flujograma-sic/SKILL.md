---
name: flujograma-sic
description: Actualiza el flujograma del circuito de la SIC (HTML, SVG y PDF) cuando cambian roles, estados, reglas de aprobación, tipos de compra, avisos o permisos de lectura.
disable-model-invocation: true
---

Actualizar el flujograma de la SIC por este cambio: $ARGUMENTS

1. Leé `docs/flujograma-sic-src/README.md` y la parte de `build.py` (nodos, flechas, rótulos, capas) y `make_html.py` (tabla `ROWS`) que corresponda. Son **retoques sobre el esquema existente**, no se rehace.
2. Editá `build.py` y/o `ROWS` para reflejar el estado real del circuito (carriles Emisor / Jefe de área / Compras / Gerencia / Pañol).
3. Corré `bash docs/flujograma-sic-src/regenerar.sh`. Debe imprimir **`PROBLEMAS: 0`**; si no, corregí el layout y repetí.
4. Mirá el render (HTML o PDF, con `probar-en-chrome` o abriendo el archivo) antes de darlo por bueno.
5. Commiteá juntos los 4 archivos de `docs/`: `flujograma-sic.html`, `.pdf`, `.svg` y la carpeta fuente `flujograma-sic-src/`, solo con el ok de Lisandro.
