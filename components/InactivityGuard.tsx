"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INACTIVITY_COOKIE = "sc_last_activity";
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const TOUCH_THROTTLE_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

// Complementa la validación de middleware.ts: esta corre en el cliente para
// cerrar la sesión aunque el usuario deje una sola pestaña abierta sin navegar.
export default function InactivityGuard() {
  const router = useRouter();
  const lastTouchRef = useRef(0);

  useEffect(() => {
    function touch() {
      const now = Date.now();
      if (now - lastTouchRef.current < TOUCH_THROTTLE_MS) return;
      lastTouchRef.current = now;
      document.cookie = `${INACTIVITY_COOKIE}=${now}; path=/; max-age=${INACTIVITY_LIMIT_MS / 1000}; samesite=lax`;
    }

    touch();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, touch, { passive: true }));

    const interval = setInterval(async () => {
      const match = document.cookie.match(new RegExp(`${INACTIVITY_COOKIE}=(\\d+)`));
      const lastActivity = match ? Number(match[1]) : Date.now();

      if (Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login?motivo=inactividad");
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, touch));
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
