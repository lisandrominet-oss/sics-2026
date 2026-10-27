# Rediseño B ("Hoja enmarcada"): maqueta de referencia

Maqueta estática aprobada por Lisandro (octubre de 2026). Es la especificación visual del rediseño de SICS; el plan de implementación está en el historial de la conversación y en `CLAUDE.md` cuando se cierre.

- `b.css`: tokens (claro y oscuro) y componentes.
- `b-tablero.html`, `b-detalle.html`, `b-nueva.html`, `b-login.html`, `b-estados.html`: las pantallas.
- `comun.js` (datos ficticios, sin montos ni correos) y `b.js` (menú, tema, aviso).

Para verla: `python3 -m http.server 3300 -d docs/rediseno-b` y abrir `http://127.0.0.1:3300/b-tablero.html`. Con `?tema=oscuro` se ve el modo oscuro.

Los colores de marca son provisorios (tinta `#101a2b`, amarillo `#f5c400`) hasta tener el azul exacto de la indumentaria.
