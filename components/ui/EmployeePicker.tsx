"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconX } from "@/components/icons";
import { inputClass } from "@/lib/ui";
import { employeeLabel, type RosterEmployeeOption } from "@/lib/roster";

const MAX_SUGGESTIONS = 8;

// Minúsculas y sin acentos, para que "perez" encuentre "Pérez".
function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Buscador de personas con lista desplegable (apellido, nombre o legajo).
 * La lista muestra pocas coincidencias a la vez, así que ocupa lo mismo con 10 o con 300 empleados.
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
  const chipButtonRef = useRef<HTMLButtonElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [refocus, setRefocus] = useState(false);
  const [focusChip, setFocusChip] = useState(false);

  const indexed = useMemo(
    () => options.map((o) => ({ option: o, key: norm(`${o.last_name} ${o.first_name} ${o.legajo ?? ""}`) })),
    [options]
  );
  const chosen = useMemo(() => selected.map((id) => options.find((o) => o.id === id)).filter((o): o is RosterEmployeeOption => !!o), [selected, options]);
  const single = !multiple && chosen.length > 0;

  const words = norm(query).split(" ").filter(Boolean);
  const matches = useMemo(
    () => indexed.filter((c) => !selected.includes(c.option.id) && words.every((w) => c.key.includes(w))).map((c) => c.option),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indexed, selected, query]
  );
  const suggestions = matches.slice(0, MAX_SUGGESTIONS);
  const showList = open && !single;

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
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      // Solo se intercepta con una sugerencia resaltada: sin resaltar, Enter sigue siendo el del formulario.
      e.preventDefault();
      pick(suggestions[highlight]);
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
                  ? "flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1 text-sm text-slate-800"
                  : "flex items-center gap-2 rounded-lg border border-slate-300 bg-indigo-50 px-3 py-2 text-sm text-slate-800"
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
              setHighlight(e.target.value.trim() ? 0 : -1);
            }}
            onFocus={() => {
              clearTimeout(blurTimer.current);
              setOpen(true);
            }}
            onBlur={() => {
              // Pequeña demora para que el toque sobre una sugerencia llegue antes de cerrar la lista.
              blurTimer.current = setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={onKeyDown}
            placeholder={multiple && chosen.length > 0 ? "Sumar otra persona" : "Buscar por apellido, nombre o legajo"}
            aria-label={ariaLabel}
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && highlight >= 0 ? `${listId}-${highlight}` : undefined}
            className={inputClass}
          />
          {showList && (
            <ul id={listId} role="listbox" aria-multiselectable={multiple} className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {suggestions.map((o, i) => (
                <li
                  key={o.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  // onMouseDown + preventDefault: el input no pierde el foco antes de elegir (también en táctil).
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-700 ${i === highlight ? "bg-slate-100" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate">{employeeLabel(o)}</span>
                  {o.status === "licencia" && <span className="shrink-0 text-xs text-amber-700">en licencia</span>}
                  <span className="shrink-0 text-xs text-slate-400">{o.legajo ? `Leg. ${o.legajo}` : ""}</span>
                </li>
              ))}
              {suggestions.length === 0 && <li role="presentation" className="px-3 py-2 text-sm text-slate-500">No hay coincidencias.</li>}
              {matches.length > MAX_SUGGESTIONS && (
                <li role="presentation" className="px-3 py-2 text-xs text-slate-400">Hay {matches.length - MAX_SUGGESTIONS} más: seguí escribiendo para acotar.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
