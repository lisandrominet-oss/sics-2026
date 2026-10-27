"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconX } from "@/components/icons";
import { inputClass } from "@/lib/ui";
import { employeeLabel, type RosterEmployeeOption } from "@/lib/roster";

// Minúsculas y sin acentos, sin tocar el largo del texto (sirve para comparar posiciones).
function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Para buscar: además ignora comas y espacios repetidos ("minet reggiardo, lis" encuentra "Minet Reggiardo, Lisandro").
function norm(s: string) {
  return fold(s).replace(/,/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Buscador de personas con lista desplegable (apellido, nombre o legajo).
 * La lista se abre al tocar el campo o al escribir (no al recibir foco) y muestra 5 filas; el resto con scroll.
 * Mientras se escribe, el resto del nombre sugerido aparece en gris dentro del campo (Enter o → lo aceptan).
 * Individual: al elegir queda la persona con una ✕ para quitarla. Múltiple: las elegidas quedan como chips.
 */
export default function EmployeePicker({
  options,
  selected,
  onChange,
  multiple = false,
  ariaLabel,
}: {
  options: RosterEmployeeOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  ariaLabel: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const chipButtonRef = useRef<HTMLButtonElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  // Fila a la que hay que hacer scroll: solo se completa con el teclado (con el mouse no, para que la lista no salte bajo el puntero).
  const scrollTo = useRef<number | null>(null);
  // Mientras se navega con el teclado se ignora el hover: al hacer scroll, el navegador simula un movimiento del mouse y pisaría la fila resaltada.
  // Se vuelve al mouse cuando el puntero se mueve de verdad (cambian sus coordenadas).
  const keyboardNav = useRef(false);
  const lastMouse = useRef<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [refocus, setRefocus] = useState(false);
  const [focusChip, setFocusChip] = useState(false);

  const indexed = useMemo(
    () => options.map((o) => ({ option: o, key: norm(`${o.last_name} ${o.first_name} ${o.legajo ?? ""}`), label: fold(employeeLabel(o)) })),
    [options]
  );
  const chosen = useMemo(() => selected.map((id) => options.find((o) => o.id === id)).filter((o): o is RosterEmployeeOption => !!o), [selected, options]);
  const single = !multiple && chosen.length > 0;

  const words = norm(query).split(" ").filter(Boolean);
  // Los que empiezan con lo escrito van primero (así la sugerencia en gris es la primera de la lista); el resto conserva el orden.
  const suggestions = useMemo(() => {
    const q = fold(query.trimStart());
    const found = indexed.filter((c) => !selected.includes(c.option.id) && words.every((w) => c.key.includes(w)));
    if (!q) return found.map((c) => c.option);
    const starts = found.filter((c) => c.label.startsWith(q));
    const rest = found.filter((c) => !c.label.startsWith(q));
    return [...starts, ...rest].map((c) => c.option);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexed, selected, query]);
  const showList = open && !single;

  // Resto del nombre resaltado, en gris detrás de lo escrito. Solo si lo escrito es el principio exacto de "Apellido, Nombre".
  const top = highlight >= 0 ? suggestions[highlight] : undefined;
  const topLabel = top ? employeeLabel(top) : "";
  const ghost =
    showList && top && query && fold(topLabel).length === topLabel.length && fold(query).length === query.length && fold(topLabel).startsWith(fold(query)) && topLabel.length > query.length
      ? topLabel.slice(query.length)
      : "";

  // Al quitar la persona elegida vuelve el campo de búsqueda: se le devuelve el foco.
  useEffect(() => {
    if (refocus && !single) {
      inputRef.current?.focus();
      setRefocus(false);
    }
  }, [refocus, single]);

  // En el modo individual, elegir desmonta el buscador: el foco pasa a la ✕ para no quedar suelto en la página.
  useEffect(() => {
    if (focusChip && single) {
      chipButtonRef.current?.focus();
      setFocusChip(false);
    }
  }, [focusChip, single]);

  // Si alguien elegido ya no está en `options` (p. ej. se dio de baja y se refrescó la lista), se descarta para no enviarlo a ciegas.
  useEffect(() => {
    if (chosen.length !== selected.length) onChange(chosen.map((o) => o.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, selected]);

  // Con las flechas, la fila resaltada se mantiene a la vista dentro de la lista con scroll.
  useEffect(() => {
    if (scrollTo.current === null) return;
    document.getElementById(`${listId}-${scrollTo.current}`)?.scrollIntoView({ block: "nearest" });
    scrollTo.current = null;
  }, [highlight, listId]);

  function pick(o: RosterEmployeeOption) {
    onChange(multiple ? [...selected, o.id] : [o.id]);
    setQuery("");
    setHighlight(-1);
    setOpen(multiple);
    if (!multiple) setFocusChip(true);
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id));
    setRefocus(true);
  }

  function hover(i: number, e: React.MouseEvent) {
    const last = lastMouse.current;
    const moved = !last || last.x !== e.clientX || last.y !== e.clientY;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    if (moved) keyboardNav.current = false;
    if (!keyboardNav.current && i !== highlight) setHighlight(i);
  }

  function move(next: number) {
    keyboardNav.current = true;
    // Si no cambia la fila resaltada el efecto de scroll no corre: no se deja una fila pendiente.
    if (next !== highlight) scrollTo.current = next;
    setHighlight(next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (showList) {
        // Cierra solo la lista: sin esto el Escape también cerraría el modal ni, en type="search", borraría el texto.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (e.key === "Backspace" && multiple && query === "" && chosen.length > 0) {
      remove(chosen[chosen.length - 1].id);
      return;
    }
    if (!showList) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move((highlight + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(highlight <= 0 ? suggestions.length - 1 : highlight - 1);
    } else if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.nativeEvent.isComposing) {
      // Atajos del sistema y composición de texto (IME): no se interpretan como elegir.
      return;
    } else if (e.key === "ArrowRight" && ghost && top && e.currentTarget.selectionStart === query.length && e.currentTarget.selectionEnd === query.length) {
      // → con el cursor al final acepta la sugerencia en gris.
      e.preventDefault();
      pick(top);
    } else if (e.key === "Enter" && top) {
      // Solo se intercepta con una sugerencia resaltada: sin resaltar, Enter sigue siendo el del formulario.
      e.preventDefault();
      pick(top);
    }
  }

  return (
    <div>
      {chosen.length > 0 && (
        <ul className={multiple ? "mt-1 flex flex-wrap gap-2" : "mt-1"}>
          {chosen.map((o) => (
            <li
              key={o.id}
              className={
                multiple
                  ? "flex animate-scale-in items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1 text-sm text-slate-800"
                  : "flex animate-scale-in items-center gap-2 rounded-lg border border-slate-300 bg-indigo-50 px-3 py-2 text-sm text-slate-800"
              }
            >
              <span className="min-w-0 flex-1 truncate">
                {employeeLabel(o)}
                {o.legajo ? ` · Leg. ${o.legajo}` : ""}
              </span>
              {o.status === "licencia" && <span className="shrink-0 text-xs text-amber-700">en licencia</span>}
              <button
                type="button"
                ref={!multiple ? chipButtonRef : undefined}
                onClick={() => remove(o.id)}
                aria-label={`Quitar a ${employeeLabel(o)}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!single && (
        <div className="relative">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlight(norm(e.target.value) ? 0 : -1);
              if (listRef.current) listRef.current.scrollTop = 0;
            }}
            // La lista no se abre por foco (el Modal enfoca el primer campo al abrirse): se abre al tocar, al escribir o con ↓.
            onClick={() => setOpen(true)}
            onFocus={() => clearTimeout(blurTimer.current)}
            onBlur={() => {
              // Pequeña demora para que el toque sobre una sugerencia llegue antes de cerrar la lista.
              blurTimer.current = setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={onKeyDown}
            placeholder={multiple && chosen.length > 0 ? "Sumar otra persona" : "Buscar por apellido, nombre o legajo"}
            aria-label={ariaLabel}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-autocomplete="both"
            aria-activedescendant={showList && highlight >= 0 ? `${listId}-${highlight}` : undefined}
            className={inputClass}
          />
          {ghost && (
            // Mismo tamaño de letra que el campo (16 px en móvil, ver globals.css); `pl-[13px]` = padding de 12 px + borde de 1 px.
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center overflow-hidden whitespace-pre pl-[13px] pr-9 text-base sm:text-sm">
              <span className="invisible">{query}</span>
              <span className="text-slate-400">{ghost}</span>
            </div>
          )}
          {showList && (
            // 12,5 rem = 5 filas de 36 px + el padding y el borde de la lista + un asomo de la sexta, que avisa que hay scroll.
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-multiselectable={multiple}
              // Evita que tocar la barra de scroll le saque el foco al campo (y cierre la lista).
              onMouseDown={(e) => e.preventDefault()}
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[12.5rem] animate-slide-down overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-sheet py-1 shadow-lift"
            >
              {suggestions.map((o, i) => (
                <li
                  key={o.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  onClick={() => pick(o)}
                  onMouseMove={(e) => hover(i, e)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors duration-fast ease-out-expo ${i === highlight ? "bg-slate-100" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate">{employeeLabel(o)}</span>
                  {o.status === "licencia" && <span className="shrink-0 text-xs text-amber-700">en licencia</span>}
                  <span className="shrink-0 text-xs text-slate-400">{o.legajo ? `Leg. ${o.legajo}` : ""}</span>
                </li>
              ))}
              {suggestions.length === 0 && (
                <li role="presentation" className="px-3 py-2 text-sm text-slate-500">
                  No hay coincidencias.
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
