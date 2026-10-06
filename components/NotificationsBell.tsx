"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABELS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/Skeleton";
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
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
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
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="notifications-panel"
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#cbd5e1] transition-colors hover:bg-white/5 hover:text-white"
      >
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <IconBell />
          {count > 0 && (
            <span
              key={count}
              className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] animate-check-pop items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </span>
        Notificaciones
      </button>

      {open && (
        <div
          id="notifications-panel"
          className="absolute left-0 top-full z-50 mt-2 w-full animate-slide-down overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notificaciones</p>
            <p className="text-xs text-slate-400">SICs que requieren tu acción</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items === null && (
              <div role="status" aria-label="Cargando notificaciones" className="space-y-3 px-4 py-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                ))}
                <span className="sr-only">Cargando…</span>
              </div>
            )}
            {items?.length === 0 && (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="mt-3 text-sm font-medium text-slate-700">Estás al día</p>
                <p className="mt-0.5 text-xs text-slate-500">No tenés pendientes por ahora.</p>
              </div>
            )}
            {items?.map((item) => (
              <Link
                key={item.id}
                href={`/sic/${item.id}`}
                prefetch={false}
                onClick={() => dismiss(item.id)}
                className="block border-b border-slate-50 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50"
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
