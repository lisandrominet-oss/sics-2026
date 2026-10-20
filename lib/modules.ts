import type { Json } from "@/lib/database.types";
import type { UserRole } from "@/lib/constants";

// Módulos que el admin o Gerencia pueden habilitar o quitar a cada usuario. Cada rol arranca con los
// suyos (defaultRoles) y el usuario puede tener ajustes propios en profiles.module_overrides.
// Tiene que coincidir con module_default() y con la lista válida de staff_set_user_modules() en la base.
export type ModuleKey =
  | "contratos"
  | "proveedores"
  | "catalogo"
  | "certificados"
  | "recursos-humanos"
  | "logistica"
  | "administracion"
  | "personal";

export type ModuleDef = {
  key: ModuleKey;
  title: string;
  description: string;
  // Dónde aparece en el menú; "certificados" es una pestaña del tablero y no tiene entrada propia.
  group: "compras" | "modulos" | "tablero";
  href: string | null;
  defaultRoles: readonly UserRole[];
};

export const MODULES: readonly ModuleDef[] = [
  {
    key: "proveedores",
    title: "Proveedores",
    description: "Fichas, categorías, comentarios y archivos de proveedores.",
    group: "compras",
    href: "/proveedores",
    defaultRoles: ["compras", "admin"],
  },
  {
    key: "catalogo",
    title: "Catálogo",
    description: "Catálogo de artículos para las SIC.",
    group: "compras",
    href: "/catalogo",
    defaultRoles: ["compras", "admin"],
  },
  {
    key: "contratos",
    title: "Contratos",
    description: "Alquileres: cuotas, vencimientos, facturas de proveedor y alertas.",
    group: "compras",
    href: "/contratos",
    defaultRoles: ["compras", "admin"],
  },
  {
    key: "certificados",
    title: "Certificados pendientes",
    description: "Pestaña del tablero con los certificados de calidad que faltan.",
    group: "tablero",
    href: null,
    defaultRoles: ["compras", "admin"],
  },
  {
    key: "personal",
    title: "Personal",
    description: "Base de datos de empleados de toda la empresa: legajos, altas, bajas e importación.",
    group: "modulos",
    href: "/personal",
    defaultRoles: ["admin", "gerencia"],
  },
  {
    key: "recursos-humanos",
    title: "Recursos Humanos",
    description: "Personas, pagos y personal en operación.",
    group: "modulos",
    href: "/modulos/recursos-humanos",
    defaultRoles: ["admin", "gerencia"],
  },
  {
    key: "logistica",
    title: "Logística",
    description: "Movimiento de personal y de cargas.",
    group: "modulos",
    href: "/modulos/logistica",
    defaultRoles: ["admin", "gerencia"],
  },
  {
    key: "administracion",
    title: "Administración",
    description: "Finanzas y control de gestión.",
    group: "modulos",
    href: "/modulos/administracion",
    defaultRoles: ["admin", "gerencia"],
  },
];

export type ModuleOverrides = Partial<Record<ModuleKey, boolean>>;

const MODULE_KEYS = new Set<string>(MODULES.map((m) => m.key));

export function isModuleKey(value: string): value is ModuleKey {
  return MODULE_KEYS.has(value);
}

// Lo que no es un objeto de booleanos con claves conocidas se ignora.
export function parseOverrides(raw: Json | undefined | null): ModuleOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ModuleOverrides = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isModuleKey(key) && typeof value === "boolean") out[key] = value;
  }
  return out;
}

export function moduleDefault(role: UserRole | null | undefined, key: ModuleKey): boolean {
  if (!role) return false;
  return MODULES.find((m) => m.key === key)?.defaultRoles.includes(role) ?? false;
}

// Mismo criterio que has_module(key, true) en la base: el admin tiene todo; si simula otro rol ("Ver como")
// ve los módulos por defecto de ese rol; el resto, su ajuste propio y si no hay, el default del rol.
export function hasModule(
  profile: { role: UserRole | null; acting_as_role?: UserRole | null; module_overrides?: Json | null },
  key: ModuleKey
): boolean {
  if (!profile.role) return false;
  if (profile.role === "admin") {
    return profile.acting_as_role ? moduleDefault(profile.acting_as_role, key) : true;
  }
  const override = parseOverrides(profile.module_overrides)[key];
  return override ?? moduleDefault(profile.role, key);
}

export function enabledModules(profile: Parameters<typeof hasModule>[0]): ModuleKey[] {
  return MODULES.filter((m) => hasModule(profile, m.key)).map((m) => m.key);
}

// Ruta protegida → módulo que la habilita (lo usa el middleware).
export function moduleForPath(path: string): ModuleKey | null {
  if (path === "/contratos" || path.startsWith("/contratos/")) return "contratos";
  if (path === "/proveedores" || path.startsWith("/proveedores/")) return "proveedores";
  if (path === "/catalogo" || path.startsWith("/catalogo/")) return "catalogo";
  if (path === "/personal" || path.startsWith("/personal/")) return "personal";
  if (path.startsWith("/modulos/")) {
    const slug = path.split("/")[2];
    return slug && isModuleKey(slug) ? slug : null;
  }
  return null;
}

// Módulos "en construcción": solo se muestran (no hay datos ni funciones detrás) para poder
// exponer lo que el sistema va a cubrir. Cuando uno se construya, se reemplaza su tarjeta
// por un enlace real y se quita de acá.
export type DemoModule = {
  slug: string;
  title: string;
  description: string;
  sections: string[];
};

export const DEMO_MODULES: DemoModule[] = [
  {
    slug: "recursos-humanos",
    title: "Recursos Humanos",
    description: "Personas, pagos y personal en operación.",
    sections: ["Sueldos", "Liquidaciones", "Asistencias", "Reclutamiento", "Roster minero"],
  },
  {
    slug: "logistica",
    title: "Logística",
    description: "Movimiento de personal y de cargas.",
    sections: ["Roster minero", "Transporte"],
  },
  {
    slug: "administracion",
    title: "Administración",
    description: "Finanzas y control de gestión.",
    sections: [
      "Balances",
      "Estadísticas",
      "KPIs",
      "Leasings",
      "Gastos",
      "Impuestos",
      "Tesorería",
      "Presupuestos",
      "Activos fijos",
    ],
  },
];
