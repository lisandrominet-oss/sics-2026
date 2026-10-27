/* Datos y ayudas compartidas por las tres maquetas del Tablero.
   Datos ficticios: nombres inventados, sin montos (el Jefe de área no ve montos), sin correos. Hoy = martes 27/10/2026.
   Los estados y sus textos salen de lib/constants.ts (STATUS_LABELS). */

window.HOY = new Date(2026, 9, 27);
window.ETAPAS = ["Emisor", "Jefe de área", "Compras", "Gerencia", "Pañol"];

window.ESTADOS = {
  enviada: "Enviada",
  en_observacion: "En observación",
  pendiente_aprobacion_jefe: "Pendiente aprobación del jefe",
  cotizando: "En cotización",
  pendiente_aprobacion_gerencia: "Pendiente aprobación Gerencia",
  orden_emitida: "Orden de compra emitida",
  recibida: "Recibida",
};

// etapa = tramo del recorrido donde está la SIC hoy (0 emisor, 1 jefe, 2 compras, 3 gerencia, 4 pañol).
window.SICS = [
  { code: "SIC-MANT-2026-0415", asunto: "Discos de corte 115 mm, 50 unidades", sector: "Taller", pidio: "Martín Acosta", necesaria: "2026-10-29", estado: "pendiente_aprobacion_jefe", etapa: 1, mia: true },
  { code: "SIC-MANT-2026-0418", asunto: "Rodamientos 6205 y retenes para bomba de lodos", sector: "Mecánica", pidio: "Diego Ferrer", necesaria: "2026-10-30", estado: "pendiente_aprobacion_jefe", etapa: 1, mia: true },
  { code: "SIC-MANT-2026-0417", asunto: "Guantes de nitrilo y barbijos FFP2, 10 cajas", sector: "Taller", pidio: "Lucía Paz", necesaria: "2026-11-03", estado: "pendiente_aprobacion_jefe", etapa: 1, mia: true },
  { code: "SIC-MANT-2026-0403", asunto: "Mangueras hidráulicas de 3/4 pulgada, 6 unidades", sector: "Mecánica", pidio: "Diego Ferrer", necesaria: "2026-10-28", estado: "orden_emitida", etapa: 4 },
  { code: "SIC-MANT-2026-0406", asunto: "Grasa EP2, balde de 18 kg", sector: "Taller", pidio: "Martín Acosta", necesaria: "2026-11-02", estado: "pendiente_aprobacion_gerencia", etapa: 3 },
  { code: "SIC-MANT-2026-0396", asunto: "Brocas de widia de 8 a 16 mm, juego", sector: "Taller", pidio: "Martín Acosta", necesaria: "2026-11-06", estado: "cotizando", etapa: 2 },
  { code: "SIC-MANT-2026-0409", asunto: "Cable subterráneo 4x16 mm², 80 metros", sector: "Electricidad", pidio: "Sofía Ibarra", necesaria: "2026-11-10", estado: "cotizando", etapa: 2 },
  { code: "SIC-MANT-2026-0412", asunto: "Calibración de manómetros (servicio)", sector: "Mecánica", pidio: "Diego Ferrer", necesaria: "2026-11-14", estado: "en_observacion", etapa: 0 },
  { code: "SIC-MANT-2026-0399", asunto: "Lámparas LED de 120 W, 12 unidades", sector: "Electricidad", pidio: "Sofía Ibarra", necesaria: "2026-10-26", estado: "recibida", etapa: 4 },
];
window.CERRADAS = 12;
window.TOTAL = 21;
window.MIAS = window.SICS.filter((s) => s.mia);
console.assert(window.SICS.length + window.CERRADAS === window.TOTAL, "activas + cerradas = total");
console.assert(window.MIAS.length === 3, "tres esperan firma del jefe");

window.TINTE = { "Martín Acosta": 35, "Diego Ferrer": 215, "Lucía Paz": 150, "Sofía Ibarra": 335 };

window.fmtFecha = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return d + " " + ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1];
};
window.fmtCorta = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0");
};
window.faltan = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dias = Math.round((new Date(y, m - 1, d) - window.HOY) / 86400000);
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === 2) return "pasado mañana";
  if (dias < 0) return "hace " + -dias + (dias === -1 ? " día" : " días");
  return "en " + dias + " días";
};
window.iniciales = (n) => n.split(" ").map((p) => p[0]).join("");
window.avatar = (n) => `<span class="av" style="--h:${window.TINTE[n]}" aria-hidden="true">${window.iniciales(n)}</span>`;

// Tira del recorrido: tramos hechos, tramo actual, tramos pendientes. El nombre del tramo actual va en el aria-label.
window.tira = (etapa, cerrada) => {
  const segs = window.ETAPAS.map((e, i) => {
    const cls = cerrada || i < etapa ? "ok" : i === etapa ? "ahora" : "falta";
    return `<i class="${cls}"></i>`;
  }).join("");
  const txt = cerrada ? "Cerrada" : "En " + window.ETAPAS[etapa];
  return `<span class="tira" role="img" aria-label="Recorrido: ${txt}">${segs}</span>`;
};

const P = {
  tablero: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  nueva: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  proveedores: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
  personal: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.4c1.8.8 3 2.6 3 4.6"/>',
  aviso: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  mas: '<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
  flecha: '<path d="M9 6l6 6-6 6"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  volver: '<path d="M15 6l-6 6 6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  clip: '<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.2 3.2 0 0 1 4.5 4.5L9.5 17a1.5 1.5 0 0 1-2-2L15 7.5"/>',
  perfil: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
};
window.ico = (n, s = 18) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
