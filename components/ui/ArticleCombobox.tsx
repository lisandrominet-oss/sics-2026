"use client";

import { useId, useMemo, useRef, useState } from "react";
import { inputClass } from "@/lib/ui";
import { cn } from "@/lib/cn";

const MAX_SUGGESTIONS = 8;

// Minúsculas y sin acentos, igual que catalog_norm() en la base (la ñ también se pliega).
function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Campo de artículo con sugerencias del catálogo. Es un input de texto libre:
 * el valor siempre es lo que se escribió; elegir una sugerencia solo completa el texto.
 * `catalog` viene ordenado por uso (los más pedidos primero).
 */
export default function ArticleCombobox({
  value,
  onChange,
  catalog,
  placeholder,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  catalog: string[];
  placeholder?: string;
  required?: boolean;
}) {
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const normalized = useMemo(() => catalog.map((name) => ({ name, key: norm(name) })), [catalog]);
  const query = norm(value);
  const words = query ? query.split(" ") : [];

  const suggestions = useMemo(() => {
    const matches = normalized.filter((c) => words.every((w) => c.key.includes(w)));
    // Los que empiezan con lo escrito van primero; el resto conserva el orden por uso.
    const starts = matches.filter((c) => query && c.key.startsWith(query));
    const rest = matches.filter((c) => !starts.includes(c));
    return [...starts, ...rest].slice(0, MAX_SUGGESTIONS).map((c) => c.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, query]);

  const exactMatch = query !== "" && normalized.some((c) => c.key === query);
  // Solo se avisa cuando nada del catálogo coincide: mientras se escribe el principio de uno existente no es "nuevo".
  const isNew = query !== "" && suggestions.length === 0 && catalog.length > 0;
  const showList = open && suggestions.length > 0 && !(suggestions.length === 1 && exactMatch);

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    setHighlight(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!showList) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      // Solo se intercepta si hay una sugerencia resaltada: sin resaltar, Enter sigue siendo el del formulario.
      e.preventDefault();
      pick(suggestions[highlight]);
    }
  }

  return (
    <div>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHighlight(-1);
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
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && highlight >= 0 ? `${listId}-${highlight}` : undefined}
          className={inputClass}
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-sheet py-1 shadow-pop"
          >
            {suggestions.map((name, i) => (
              <li
                key={name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                // onMouseDown + preventDefault: el input no pierde el foco antes de elegir (también en táctil).
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(name);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm text-slate-700 [overflow-wrap:anywhere]",
                  i === highlight && "bg-slate-100"
                )}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {isNew && (
        <p className="mt-1 text-xs text-slate-400">Artículo nuevo: se agrega al catálogo al enviar la solicitud.</p>
      )}
    </div>
  );
}
