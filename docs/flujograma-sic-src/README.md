# Flujograma de SIC — cómo mantenerlo

Esquema único y vivo del circuito de una SIC (carriles Emisor, Jefe de área, Compras, Gerencia, Pañol).
Cuando cambie el sistema, se retoca **este mismo esquema**, no se rehace.

## Archivos
- `build.py` — el esquema: nodos, flechas, rótulos y capas (archivos, avisos, reglas). Trae un verificador
  de layout (textos que no entran, superposiciones, flechas que cruzan cajas o se cruzan entre sí).
- `make_html.py` — arma la página interactiva y la **tabla resumen** (lista `ROWS`) y la fecha de versión.
- `regenerar.sh` — corre todo y deja `docs/flujograma-sic.html`, `.svg` y `.pdf` (A3 apaisado, 2 páginas).

## Cómo retocarlo
1. Editar `build.py`: `node(...)` (cajas), `edge(...)` (flechas, con puntos ortogonales), `label(...)`,
   `tag("files" | "notif" | "rules", ...)`. Las flechas se anclan con `side("ID", "l|r|t|b")`.
2. Si cambia un paso, actualizar la fila correspondiente de `ROWS` en `make_html.py` y la fecha de versión.
3. `bash docs/flujograma-sic-src/regenerar.sh` — debe imprimir `PROBLEMAS: 0`. Si lista problemas, mover
   la caja o el rótulo señalado hasta que quede en cero.
4. Mirar el resultado renderizado antes de dar por bueno el cambio.

## Qué hay que reflejar cuando cambie el sistema
Roles nuevos, estados nuevos, reglas de aprobación (tope de Gerencia), tipos de compra, quién recibe avisos,
permisos de lectura y archivos obligatorios u opcionales por paso.
