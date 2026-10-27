---
name: presentacion-a4
description: Arma o modifica la presentación de SICS en /presentacion (hojas A4 verticales, celulares con la app, PDF). Usar cuando haya que sumar, cambiar o actualizar hojas de la presentación.
disable-model-invocation: true
---

# Presentación de SICS (A4 vertical)

Pedido: $ARGUMENTS

Vive en `app/presentacion/` y está **detrás del login** (el middleware no se toca). Máximo 10 hojas, pensadas para leerse en el celular y en la compu.

## Estructura
- `page.tsx` lista las hojas; cada una es un archivo en `_hojas/` (`HojaNNNombre.tsx`). `TOTAL` se actualiza en `page.tsx`.
- `_components/Hoja.tsx` (encabezado y número), `Celular.tsx` (marco), `Aparece.tsx` (entrada al hacer scroll), `Rol.tsx` (color por carril), `BarraSuperior.tsx`.
- `_pantallas/` tiene las maquetas de la app dentro del celular. Reusan `components/ui` y `StatusBadge`, y no llevan clases responsive (`sm:`, `lg:`).
- `_data/sics-demo.ts` guarda los datos de las maquetas.
- `presentacion.css` define la hoja A4 y la impresión. Una hoja = una página de PDF.

## Reglas de diseño
- Todo en **rem**: 1 rem de referencia = 16 px a 794 px de ancho de hoja; el rem escala con el ancho de la hoja.
- Texto de lectura **≥ 1,9 rem** (≈ 14 px reales en un celular de 390 px). Poco texto por hoja: un título, una idea y, si hace falta, un celular.
- Colores y componentes de la app (rediseño B): escala `slate`, tinta (`ink`), amarillo de marca (`brand`) y los tonos de estado; tipografía IBM Plex Sans. Nada de colores crudos (hex) ni de paletas viejas (índigo, violeta, celeste). Sin librerías nuevas ni Motion/GSAP.
- Movimiento solo con `Aparece` (fade-up de `tailwind.config.ts`); respeta `prefers-reduced-motion`.
- Siempre en claro: `ForzarClaro` saca la clase `dark`.

## Datos
- Se leen de la base **solo con SELECT** y quedan **sin personas, correos, montos ni proveedores**: las personas se reemplazan por su rol.
- Personal y Roster usan datos inventados.
- No poner el valor real del tope de Gerencia sin confirmación de Lisandro.
- Todo dato que aparezca en una hoja debe poder rastrearse a `docs/flujograma-sic-src/make_html.py` (`ROWS`), `lib/constants.ts` o la base.

## Capturas reales de compu
Las hojas 3, 4 y 8 llevan capturas reales de la app dentro de una ventana de navegador (`_components/Navegador.tsx`).
- Se sacan con Claude in Chrome en una **pestaña nueva** (la pestaña de un Chrome en segundo plano no deja capturar) contra el dev server, con la sesión de Lisandro.
- **Antes de capturar se tapan los datos sensibles en el navegador** (solo el DOM, no se toca la base): personas y correos se reemplazan por el rol o «Operativo», montos por `$ ••••••`, nombres de archivos de proveedores por nombres genéricos, miniaturas con blur. Después se verifica por texto que no queden nombres, correos ni montos (`document.body.innerText`).
- El menú lateral de la app ya es sticky y llega hasta abajo: no hace falta `zoom` ni fijar alturas. La pestaña de Chrome tiene que medir 1360 px de ancho (`resize_window`) para que se vea el menú de compu; si el viewport queda en 1000 px se ve la versión de celular.
- Para ver formularios llenos solo se escribe en los campos: **nunca enviar** (producción).
- Las capturas recortadas van en `_img/*.jpg` (1360 px de ancho). Se recortan desde arriba con Pillow (`sips` centra el recorte y se come el encabezado). Para actualizarlas: `node scripts/capturas-presentacion.js` regenera `_data/capturas.ts`, que las embebe en base64. No van en `public/`: las imágenes de `public/` son abiertas aunque la página pida login.
- Ejemplo de trazabilidad completa: la SIC con más pasos (hoy SIC-COMP-2026-0001, 8 estados). Si cambia, actualizar también `RECORRIDO` en `_data/sics-demo.ts`.

## PDF
La ruta pide login, así que el PDF lo genera Lisandro desde su Chrome: botón «Guardar PDF» (o Cmd+P, Guardar como PDF, sin márgenes ni encabezados).
Verificar con `python3 -c "from pypdf import PdfReader; r=PdfReader('<archivo>'); print(len(r.pages), r.pages[0].mediabox)"`: debe dar **una página por hoja** y 595×842. Más páginas que hojas = una hoja se desborda.

## Verificación
1. `npx tsc --noEmit | grep -c "error TS"` no suma errores nuevos (base: 83).
2. `probar-en-chrome` en `http://localhost:3000/presentacion`: 390×844 y 1440 de ancho, sin scroll horizontal, texto ≥ 14 px reales, consola sin errores, y claro aunque el sistema esté en oscuro.
3. Si cambia el circuito, roles, estados o tope: actualizar también el flujograma (`/flujograma-sic`).
