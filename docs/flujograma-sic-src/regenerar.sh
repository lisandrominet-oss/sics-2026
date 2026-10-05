#!/bin/bash
# Regenera el flujograma de SIC (HTML, SVG y PDF A3) a partir de build.py y make_html.py.
# Uso, desde la raíz del proyecto:  bash docs/flujograma-sic-src/regenerar.sh
set -e
cd "$(dirname "$0")/../.."
python3 docs/flujograma-sic-src/build.py          # imprime "PROBLEMAS: 0" si el layout está limpio
python3 docs/flujograma-sic-src/make_html.py       # escribe docs/flujograma-sic.html y .svg
rm -f docs/flujograma-sic.pdf
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --no-pdf-header-footer --print-to-pdf=docs/flujograma-sic.pdf "file://$(pwd)/docs/flujograma-sic.html" >/dev/null 2>&1
rm -f flow.svg
echo "Listo: docs/flujograma-sic.html, .svg y .pdf"
