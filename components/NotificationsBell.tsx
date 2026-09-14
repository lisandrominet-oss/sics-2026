"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPendingSicsList, type PendingSicSummary } from "@/lib/pendingSics";
import { STATUS_LABELS, type UserRole } from "@/lib/constants";
import { IconBell } from "@/components/icons";

export default function NotificationsBell({
  role,
  userId,
  pendingCount,
}: {
  role: UserRole;
  userId: string;
  pendingCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PendingSicSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      setLoading(true);
      const supabase = createClient();
      const data = await getPendingSicsList(supabase, role, userId);
      setItems(data);
      setLoading(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
      >
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <IconBell />
          {pendingCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </span>
        Notificaciones
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notificaciones</p>
            <p className="text-xs text-slate-400">SICs que requieren tu acción</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-4 py-6 text-center text-sm text-slate-400">Cargando…</p>}
            {!loading && items?.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No tenés pendientes por ahora.</p>
            )}
            {!loading &&
              items?.map((item) => (
                <Link
                  key={item.id}
                  href={`/sic/${item.id}`}
                  onClick={() => setOpen(false)}
                  className="block border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{item.code}</p>
                  <p className="truncate text-xs text-slate-500">{item.subject}</p>
                  <p className="mt-1 text-[11px] font-medium text-indigo-600">
                    {STATUS_LABELS[item.status]}
                  </p>
                </Link>
              ))}
          </div>
          <Link
            href="/dashboard?filter=mia"
            onClick={() => setOpen(false)}
            className="block bg-slate-50 px-4 py-2.5 text-center text-xs font-semibold text-indigo-600 hover:bg-slate-100"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
