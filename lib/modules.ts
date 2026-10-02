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
    sections: ["Sueldos", "Liquidaciones", "Asistencias", "Reclutamiento", "Base de datos", "Roster minero"],
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

// Solo admin y gerencia ven los módulos de demostración.
export const DEMO_MODULE_ROLES = ["admin", "gerencia"] as const;
