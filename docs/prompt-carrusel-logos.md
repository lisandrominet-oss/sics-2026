# Tarea: carrusel de logos "Empresas que confían en nosotros"

Quiero que implementes en esta web una franja de logos de clientes con el mismo efecto que se ve en vercel.com (sección de logos justo debajo del hero). Trabajá con el método **Explorar → Planificar → Codificar → Verificar**. No escribas código hasta haberme mostrado el plan y tener mi OK.

## 1. Qué tiene que verse (referencia visual)
- Una fila horizontal de logos de empresas, **todos en un solo color (blanco o gris claro) sobre el fondo oscuro**, sin colores de marca, sin cajas ni bordes alrededor de cada logo.
- Los logos tienen **la misma altura visual** (~24–32 px) y ancho automático según su proporción; separación pareja entre ellos (~48–80 px).
- Opcional encima de la fila: un texto chico y discreto tipo "Empresas que confían en nosotros" (texto: [COMPLETAR O DEJAR VACÍO]).
- Comportamiento: **marquee infinito** hacia la izquierda, lento y constante (una vuelta completa en ~30–40 s), **sin saltos ni cortes** al reiniciar el loop.
- Los bordes izquierdo y derecho **se desvanecen** (fade a transparente) para que los logos entren y salgan suavemente.
- Pausa al pasar el mouse por encima (hover) en desktop.
- Si el usuario tiene `prefers-reduced-motion: reduce`: **sin animación**, fila estática que haga wrap o scroll horizontal manual.
- En mobile: mismo efecto, logos un poco más chicos (~20–24 px de alto), sin scroll horizontal de la página.

## 2. Logos
- Los logos a mostrar son: [LISTA DE EMPRESAS Y RUTA/URL DE CADA LOGO]. Si algún archivo falta, **frená y preguntame**; no inventes logos, no descargues logos de internet y no uses logos de empresas que no sean clientes nuestros.
- Preferí **SVG**. Si algún logo viene en PNG/JPG con fondo, avisame antes de procesarlo.
- Para unificar el color sin editar cada archivo, usá CSS: `filter: brightness(0) invert(1); opacity: .7` (sube a `opacity: 1` en hover). Si un SVG ya usa `currentColor`, usá eso en lugar del filtro.
- Cada `<img>` con `alt` con el nombre de la empresa, `height` fijo, `width: auto`, `loading="lazy"` salvo que esté en el primer viewport, y `draggable="false"`.

## 3. Cómo implementarlo (técnica)
- **Sin librerías nuevas** (nada de Swiper, Embla, Framer Motion, GSAP, etc.). Solo CSS + el framework que el proyecto ya use.
- Técnica de marquee seamless: un contenedor con `overflow: hidden` y adentro un "track" con `display: flex; width: max-content` que contiene **el mismo grupo de logos dos veces**; animar `transform: translateX(0) → translateX(-50%)` con `animation: marquee <duración> linear infinite`. El segundo grupo va con `aria-hidden="true"`.
- Si el grupo de logos es corto y no llena el ancho de pantallas grandes (≥1920 px), repetí el grupo las veces necesarias dentro de cada mitad para que nunca se vea un hueco.
- Fade en los bordes con máscara: `mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)` (incluir `-webkit-mask-image`).
- Pausa en hover: `.marquee:hover .track { animation-play-state: paused }`.
- Reduced motion: `@media (prefers-reduced-motion: reduce) { .track { animation: none } }`.
- Usá `will-change: transform` solo en el track; animá únicamente `transform` (nada de `left`/`margin`) para que sea fluido.
- Accesibilidad: el contenedor con `role="region"` y `aria-label="Empresas que confían en nosotros"` (o una lista `<ul>` con `<li>` por logo).
- Ajustá la velocidad en función de la cantidad de logos (duración = cantidad de logos × ~4–5 s) y dejala como variable CSS (`--marquee-duration`) para poder tocarla fácil.

## 4. Reglas para no romper nada
1. **Primero explorá**: framework (Next/React/Astro/HTML plano…), dónde está el hero, cómo se manejan estilos (Tailwind, CSS modules, styled-components…), tema oscuro/claro, y dónde viven las imágenes (`public/`, `assets/`…). Seguí esas convenciones; escribí el componente como si lo hubiera escrito el mismo equipo.
2. Creá **un solo componente reutilizable** (por ejemplo `LogoMarquee`) que reciba la lista de logos por props/datos, y colocalo justo debajo del hero. No toques otras secciones.
3. Si el fondo de la web **no es oscuro**, adaptá el color de los logos (gris oscuro en vez de blanco) y el color de la máscara, y avisame.
4. No agregues dependencias, no cambies configuración de build, no toques variables de entorno ni archivos `.env`, y no hagas `git push`. Commits solo si te lo pido.
5. No inventes datos: nombres, URLs o logos que no te haya dado, los preguntás.

## 5. Plan y verificación
- **Antes de codear**: devolveme un plan corto con archivos a crear/modificar, dónde se va a montar el componente y cómo lo vas a verificar. Esperá mi OK.
- **Después de codear**, verificá con evidencia (no digas "listo" sin esto):
  1. Que el proyecto compile/tipee sin errores nuevos (`build`, `tsc` o lo que haya).
  2. Levantá el dev server y comprobá en el navegador, con screenshots: (a) desktop ancho, (b) mobile ~375 px.
  3. Que el loop no tenga salto visible en el reinicio (esperá al menos una vuelta completa o inspeccioná el `translateX`).
  4. Que haya pausa en hover y que con `prefers-reduced-motion` la animación se detenga.
  5. Que no aparezca scroll horizontal en la página y que no haya errores en la consola.
- Cerrá con un resumen: archivos tocados, decisiones tomadas (velocidad, tamaños), y qué **no pudiste probar**.
