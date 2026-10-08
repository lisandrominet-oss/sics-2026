"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CACHE_PREFIX = "sc_avatar:";
const URL_TTL_SECONDS = 3600;
export const AVATAR_EVENT = "sc-avatar-changed";

// Primera letra de la primera y de la última palabra, por grafemas: un emoji o un carácter con acento no se corta a la mitad.
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("es", { granularity: "grapheme" }) : null;
function firstGrapheme(word: string) {
  if (!word) return "";
  if (segmenter) {
    for (const part of segmenter.segment(word)) return part.segment;
  }
  return Array.from(word)[0] ?? "";
}

function initials(name: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? firstGrapheme(parts[0]) : firstGrapheme(parts[0]) + firstGrapheme(parts[parts.length - 1]);
  return letters.toUpperCase() || "?";
}

export function clearAvatarCache(userId: string) {
  try {
    sessionStorage.removeItem(CACHE_PREFIX + userId);
  } catch {
    // sin almacenamiento: no hay caché que limpiar
  }
}

export function setAvatarCache(userId: string, url: string) {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + userId,
      JSON.stringify({ url, exp: Date.now() + (URL_TTL_SECONDS - 120) * 1000 })
    );
  } catch {
    // sin almacenamiento: se vuelve a pedir en la próxima pantalla
  }
}

function readCache(userId: string): string | null | undefined {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + userId);
    if (!raw) return undefined;
    const c = JSON.parse(raw) as { url: string | null; exp: number };
    return c.exp > Date.now() ? c.url : undefined;
  } catch {
    return undefined;
  }
}

export default function UserAvatar({
  userId,
  fullName,
  size = "h-8 w-8",
  text = "text-xs",
}: {
  userId: string;
  fullName: string | null;
  size?: string;
  text?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache(userId);
    if (cached !== undefined) {
      setUrl(cached);
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data: row } = await supabase.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
      if (cancelled) return;
      if (!row?.avatar_path) {
        setUrl(null);
        try {
          sessionStorage.setItem(CACHE_PREFIX + userId, JSON.stringify({ url: null, exp: Date.now() + 300 * 1000 }));
        } catch {
          // ignorar
        }
        return;
      }
      const { data } = await supabase.storage.from("avatars").createSignedUrl(row.avatar_path, URL_TTL_SECONDS);
      if (cancelled) return;
      setUrl(data?.signedUrl ?? null);
      if (data?.signedUrl) setAvatarCache(userId, data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // La página de Preferencias avisa cuando se cambia o quita la foto.
  useEffect(() => {
    const onChange = (e: Event) => {
      setFailed(false);
      setUrl((e as CustomEvent<{ url: string | null }>).detail.url);
    };
    window.addEventListener(AVATAR_EVENT, onChange);
    return () => window.removeEventListener(AVATAR_EVENT, onChange);
  }, []);

  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" onError={() => setFailed(true)} className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-slate-700 ${text} font-semibold text-white`}
    >
      {initials(fullName)}
    </div>
  );
}
