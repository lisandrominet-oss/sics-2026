// Clases compartidas de formularios. El tamaño de letra en móvil (16 px, para que iOS no haga zoom al enfocar) lo fija app/globals.css.
export const inputClass = "mt-1 w-full min-h-11 rounded-lg border border-slate-300 px-3 py-1.5 text-sm sm:min-h-9";

// Campo compacto (selects y entradas dentro de tablas y filas).
export const inputCompactClass = "rounded-md border border-slate-300 px-2 py-1 text-sm";

// Control de filtro (búsqueda y selects sobre una lista): misma altura que el campo de formulario, sin margen superior.
export const filterClass = "min-h-11 rounded-lg border border-slate-300 px-3 py-1.5 text-sm sm:min-h-9";

// Etiqueta de campo de formulario.
export const labelClass = "block text-sm font-medium text-slate-900";

// Etiqueta pequeña sobre un título o un dato (sentence case, sin mayúsculas sostenidas).
export const eyebrowClass = "text-[13px] text-slate-500";

// Cifras alineadas en columnas (montos, cantidades, códigos, fechas).
export const numClass = "tabular-nums";
