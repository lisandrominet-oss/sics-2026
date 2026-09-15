import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

// Cierre de sesión por inactividad: se guarda la marca de tiempo de la última
// actividad en una cookie no-httpOnly (la actualiza también InactivityGuard en
// el cliente ante mouse/teclado) y acá se valida en cada request.
const INACTIVITY_COOKIE = "sc_last_activity";
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (user && !isPublic) {
    const lastActivityRaw = request.cookies.get(INACTIVITY_COOKIE)?.value;
    const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : null;
    const inactiveTooLong =
      !!lastActivity && !Number.isNaN(lastActivity) && Date.now() - lastActivity > INACTIVITY_LIMIT_MS;

    if (inactiveTooLong) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("motivo", "inactividad");
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      redirectResponse.cookies.delete(INACTIVITY_COOKIE);
      return redirectResponse;
    }

    response.cookies.set(INACTIVITY_COOKIE, String(Date.now()), {
      path: "/",
      maxAge: INACTIVITY_LIMIT_MS / 1000,
      sameSite: "lax",
    });
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let profile: Database["public"]["Tables"]["profiles"]["Row"] | null = null;

  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    profile = data;

    const hasRole = !!profile?.role && profile.active;

    if (!hasRole && path !== "/pendiente" && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/pendiente";
      return NextResponse.redirect(url);
    }

    if (hasRole && (path === "/login" || path === "/pendiente")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (hasRole && path.startsWith("/admin") && profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Reenviamos el perfil ya validado al Server Component vía header, para que
  // getCurrentProfile() no tenga que repetir la validación de sesión + consulta
  // por cada navegación (esa duplicación era la causa principal de la lentitud).
  if (profile) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-profile", encodeURIComponent(JSON.stringify(profile)));
    const headeredResponse = NextResponse.next({ request: { headers: requestHeaders } });
    response.cookies.getAll().forEach((cookie) => headeredResponse.cookies.set(cookie));
    return headeredResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
