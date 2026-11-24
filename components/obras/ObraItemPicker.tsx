"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { filterClass, inputClass, labelClass, numClass } from "@/lib/ui";
import { cn } from "@/lib/cn";
import {
  OBRA_NODE_COLUMNS,
  buildObraTree,
  formatShortDate,
  nodeLabel,
  nodePathText,
  rollupDates,
  type ObraNode,
} from "@/lib/obras";

const MAX_RESULTS = 60;
const PAGE = 1000;
const GENERAL = "__general";

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Sin caché entre pantallas: el plan puede cambiar (importación, bajas) y el selector siempre muestra lo vigente.
async function loadNodes(projectId: string): Promise<ObraNode[]> {
  const supabase = createClient();
  const out: ObraNode[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("project_nodes")
      .select(OBRA_NODE_COLUMNS)
      .eq("project_id", projectId)
      .order("position")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as ObraNode[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/**
 * "Ítem de la obra" de una SIC: aparece solo si el proyecto elegido tiene plan.
 * Es opcional; sin elegir, la SIC queda como "General del proyecto" (value null).
 */
export default function ObraItemPicker({
  projectId,
  value,
  onChange,
  onPlanLoaded,
  variant = "form",
}: {
  projectId: string | null;
  value: string | null;
  onChange: (nodeId: string | null) => void;
  /** `filter`: para el Tablero (sin etiqueta ni ayuda; vacío = todos los ítems). */
  variant?: "form" | "filter";
  /** Avisa si el proyecto tiene plan (para quien necesite saberlo). */
  onPlanLoaded?: (hasPlan: boolean) => void;
}) {
  const listId = useId();
  const inputId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  const [nodes, setNodes] = useState<ObraNode[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const onPlanLoadedRef = useRef(onPlanLoaded);
  onPlanLoadedRef.current = onPlanLoaded;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!projectId) {
      setNodes([]);
      onPlanLoadedRef.current?.(false);
      return;
    }
    setNodes(null);
    loadNodes(projectId)
      .then((list) => {
        if (cancelled) return;
        setNodes(list);
        onPlanLoadedRef.current?.(list.length > 0);
      })
      .catch(() => {
        if (cancelled) return;
        setNodes([]);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const tree = useMemo(() => buildObraTree(nodes ?? []), [nodes]);
  const dates = useMemo(() => rollupDates(tree), [tree]);
  const options = useMemo(
    () =>
      tree.ordered
        .filter((n) => n.active)
        .map((n) => ({ node: n, path: nodePathText(tree, n.id), key: norm(`${n.code} ${n.name}`) })),
    [tree]
  );

  const q = norm(query);
  const words = q ? q.split(/\s+/) : [];
  const matches = useMemo(() => {
    const list = words.length ? options.filter((o) => words.every((w) => o.key.includes(w) || norm(o.path).includes(w))) : options;
    return list.slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, q]);
  const items = [GENERAL, ...matches.map((m) => m.node.id)];

  if (failed) {
    return <p className="text-xs text-red-600">No se pudo cargar el plan de la obra. Recargá la página para elegir el ítem.</p>;
  }
  if (!projectId || !nodes || nodes.length === 0) return null;
  const isFilter = variant === "filter";

  const selected = value ? tree.byId.get(value) ?? null : null;
  const selectedStart = selected ? dates.get(selected.id)?.current.start ?? null : null;

  function pick(id: string) {
    onChange(id === GENERAL ? null : id);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      pick(items[highlight]);
    }
  }

  return (
    <div className={cn(isFilter && "min-w-[min(16rem,100%)] flex-1 sm:max-w-sm")}>
      <label htmlFor={inputId} className={isFilter ? "sr-only" : labelClass}>
        Ítem de la obra {!isFilter && <span className="font-normal text-slate-500">(opcional)</span>}
      </label>
      <div className="relative">
        <input
          id={inputId}
          value={open ? query : selected ? nodeLabel(selected) : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            clearTimeout(blurTimer.current);
            setQuery("");
            setOpen(true);
            setHighlight(0);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            selected ? nodeLabel(selected) : isFilter ? "Todos los ítems de la obra" : "General del proyecto · buscá por código o nombre"
          }
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
          className={isFilter ? cn(filterClass, "w-full bg-sheet") : inputClass}
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-sheet py-1 shadow-pop"
          >
            {items.map((id, i) => {
              const m = id === GENERAL ? null : matches[i - 1];
              const isSelected = id === GENERAL ? !value : id === value;
              return (
                <li
                  key={id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(id);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn("cursor-pointer px-3 py-2 text-sm", i === highlight && "bg-slate-100")}
                >
                  {m ? (
                    <>
                      {m.path && <span className="block truncate text-xs text-slate-500">{m.path}</span>}
                      <span className={cn("block [overflow-wrap:anywhere]", m.node.kind === "wbs" ? "font-medium text-slate-900" : "text-slate-700")}>
                        <span className={cn("mr-1.5 text-xs text-slate-500", numClass)}>{m.node.code}</span>
                        {m.node.name}
                      </span>
                    </>
                  ) : (
                    <span className="block text-slate-700">
                      {isFilter ? "Todos los ítems de la obra" : "General del proyecto (herramientas, consumibles…)"}
                    </span>
                  )}
                </li>
              );
            })}
            {matches.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Ningún ítem coincide.</li>}
          </ul>
        )}
      </div>
      {!isFilter && <p className="mt-1 text-xs text-slate-500">
        {selected
          ? [nodePathText(tree, selected.id), selectedStart && `Este ítem arranca el ${formatShortDate(selectedStart)}`].filter(Boolean).join(" · ") ||
            "Ítem de la obra elegido."
          : "Sin elegir, la SIC queda como General del proyecto."}
        {selected && !selected.active && " Este ítem está dado de baja."}
      </p>}
    </div>
  );
}
