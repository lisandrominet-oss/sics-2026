"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABELS } from "@/lib/constants";
import { IconBell } from "@/components/icons";
import type { Database } from "@/lib/database.types";

type Notification = {
  id: string;
  code: string;
  subject: string;
  status: Database["public"]["Enums"]["sic_status"];
  updated_at: string;
};

export default function NotificationsBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("get_pending_notifications", { p_limit: 20 })
      .then(({ data }) => setItems(data ?? []));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function dismiss(sicId: string) {
    setItems((prev) => (prev ? prev.filter((it) => it.id !== sicId) : prev));
    const supabase = createClient();
    await supabase
      .from("notification_reads")
      .upsert({ profile_id: userId, sic_id: sicId, read_at: new Date().toISOString() });
  }

  const count = items?.length ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
      >
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <IconBell />
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {count > 9 ? "9+" : count}
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
            {items === null && <p className="px-4 py-6 text-center text-sm text-slate-400">Cargando…</p>}
            {items?.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No tenés pendientes por ahora.</p>
            )}
            {items?.map((item) => (
              <Link
                key={item.id}
                href={`/sic/${item.id}`}
                onClick={() => dismiss(item.id)}
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
