# -*- coding: utf-8 -*-
"""Genera el flujograma completo de una SIC (HTML interactivo + SVG) y verifica colisiones."""
import json, sys, html

W, H = 2950, 2020
FONT = "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif"

LANES = [  # nombre, líneas, y0, y1, tinte de carril, borde
    ("EMISOR", ["Operativo,", "Pañol o jefe"], 120, 380, "#EEF3FA", "#5B7BA6"),
    ("JEFE DE ÁREA", ["Aprueba lo de", "su equipo"], 380, 640, "#F1EEF8", "#7B6BA8"),
    ("COMPRAS", ["Revisa, cotiza,", "emite y cierra"], 640, 1250, "#EAF5EF", "#4E8E75"),
    ("GERENCIA", ["Aprueba si se", "supera el tope"], 1250, 1480, "#F8F1E6", "#A98756"),
    ("PAÑOL", ["Recibe la", "mercadería"], 1480, 1700, "#EEF0F2", "#6F7C85"),
]
LANE_IDX = {"emisor": 0, "jefe": 1, "compras": 2, "gerencia": 3, "panol": 4}
NODE_FILL = {0: "#DDE8F6", 1: "#E5DFF3", 2: "#D4ECE1", 3: "#F3E5CF", 4: "#E0E4E7"}

nodes = {}     # id -> dict
edges = []     # dict
labels = []    # dict
tags = []      # dict
rects_all = [] # para colisiones: (name, x0,y0,x1,y1)

def node(id, lane, cx, cy, w, h, title, sub=None, state=None, kind="process"):
    nodes[id] = dict(id=id, lane=LANE_IDX[lane], cx=cx, cy=cy, w=w, h=h, title=title, sub=sub, state=state, kind=kind)

def side(id, s):
    n = nodes[id]
    return {"l": (n["cx"] - n["w"] / 2, n["cy"]), "r": (n["cx"] + n["w"] / 2, n["cy"]),
            "t": (n["cx"], n["cy"] - n["h"] / 2), "b": (n["cx"], n["cy"] + n["h"] / 2)}[s]

def edge(pts, style="main", end=True):
    edges.append(dict(pts=pts, style=style, end=end))

def label(cx, cy, text):
    labels.append(dict(cx=cx, cy=cy, text=text))

def tag(kind, x, y, text, w=None):
    tags.append(dict(kind=kind, x=x, y=y, text=text, w=w or int(len(text) * 16 * 0.53 + 46)))

# ---------------------------------------------------------------- nodos
node("N1", "emisor", 350, 250, 310, 104, "Emisión de la SIC", "Operativo, Pañol o jefe", "Pendiente jefe · Enviada")
node("D2", "jefe", 700, 500, 260, 104, "Decisión del jefe", "Jefe del área", "Pendiente del jefe", "decision")
node("FJ", "jefe", 700, 618, 300, 44, "Rechazada por el jefe", None, None, "final_neg")
node("D3", "compras", 980, 900, 270, 104, "Revisión de Compras", "Compras", "Enviada", "decision")
node("FC", "compras", 980, 1060, 300, 46, "Rechazada por Compras", None, None, "final_neg")
node("COT", "compras", 1330, 740, 290, 110, "Cotización", "Compra normal · Compras", "Cotizando")
node("DIR", "compras", 1330, 930, 290, 110, "Compra directa", "Sin cotización ni validación", "Aprobada o a Gerencia")
node("CC", "compras", 1330, 1120, 290, 110, "Cuenta corriente", "Proveedor habilitado", "Aprobada")
node("V6", "emisor", 1690, 255, 290, 104, "Validación técnica", "Quien emitió o su jefe", "Pendiente validación")
node("T", "compras", 1960, 930, 240, 124, "¿Supera el tope?", None, None, "diamond")
node("APR", "compras", 2260, 930, 150, 50, "Aprobada", None, None, "chip")
node("G", "gerencia", 1960, 1365, 310, 104, "Decisión de Gerencia", "Gerencia", "Pendiente Gerencia", "decision")
node("FG", "gerencia", 1560, 1365, 320, 46, "Rechazada por Gerencia", None, None, "final_neg")
node("OC", "compras", 2530, 930, 250, 104, "Orden de compra", "Compras", "Orden emitida")
node("REC", "panol", 2640, 1590, 250, 104, "Recepción", "Pañol (todas las áreas)", "Recibida")
node("CIE", "compras", 2810, 770, 240, 110, "Cierre", "Compras", "Cerrada")
node("FCER", "compras", 2810, 670, 160, 46, "Cerrada", None, None, "final_ok")
node("PEND", "compras", 2490, 770, 300, 84, "Liquidación mensual", "Cuenta corriente", "Pendiente de desarrollo", "pending")

# ---------------------------------------------------------------- flechas
S = side
edge([S("N1", "r"), (700, 250), S("D2", "t")])                                   # operativo/pañol -> jefe
edge([S("N1", "l"), (172, 250), (172, 900), S("D3", "l")], "alt")                # salta al jefe
edge([S("D2", "r"), (1000, 500), (1000, 848)], "main")                           # jefe aprueba -> compras
edge([S("D2", "l"), (330, 500), (330, 302)], "loop")                             # corrección jefe -> emisor
edge([(900, 848), (900, 700), (330, 700), (330, 500)], "loop", end=False)        # corrección compras (se une)
edge([S("D2", "b"), S("FJ", "t")], "alt")                                        # rechazo jefe
edge([S("D3", "b"), S("FC", "t")], "alt")                                        # rechazo compras
edge([S("D3", "r"), (1150, 900)], "main", end=False)                             # a la bifurcación
edge([(1150, 900), (1150, 740), S("COT", "l")], "main")
edge([(1150, 900), S("DIR", "l")], "main")
edge([(1150, 900), (1150, 1120), S("CC", "l")], "main")
edge([S("COT", "r"), (1500, 740), (1500, 255), S("V6", "l")], "main")            # cotización -> validación
edge([S("V6", "t"), (1690, 165), (1330, 165), S("COT", "t")], "loop")            # corrección validación -> cotizar
edge([S("V6", "r"), (1960, 255), S("T", "t")], "main")                           # valida -> tope
edge([S("DIR", "r"), S("T", "l")], "main")                                       # directa -> tope
edge([S("T", "r"), S("APR", "l")], "main")                                       # no supera -> aprobada
edge([S("T", "b"), S("G", "t")], "alt")                                          # supera -> gerencia
edge([S("G", "r"), (2260, 1365), S("APR", "b")], "main")                         # gerencia aprueba
edge([S("G", "l"), S("FG", "r")], "alt")                                         # gerencia rechaza
edge([S("CC", "b"), (1330, 1440), (2260, 1440), (2260, 955)], "main")            # cta cte -> aprobada
edge([S("APR", "r"), S("OC", "l")], "main")
edge([(2640, 982), S("REC", "t")], "main")                                       # OC -> recepción (sale por la base de OC)
edge([S("REC", "r"), (2810, 1590), S("CIE", "b")], "main")                       # recepción -> cierre
edge([S("CIE", "t"), S("FCER", "b")], "main")
edge([S("CIE", "l"), S("PEND", "r")], "pend")

# ---------------------------------------------------------------- rótulos
label(590, 250, "Operativo o Pañol")
label(500, 900, "Si emite jefe, Compras o Gerencia: salta al jefe")
label(915, 500, "Aprueba")
label(450, 500, "Pide corrección")
label(615, 700, "Pide corrección")
label(782, 577, "Rechaza")
label(980, 995, "Rechaza")
label(1500, 500, "Envía a validación")
label(1510, 165, "Pide corrección")
label(1898, 255, "Aprueba")
label(1640, 930, "Compra directa: se compara el monto")
label(2132, 930, "No")
label(1960, 1150, "Sí: supera el tope")
label(2188, 1365, "Aprueba")
label(1762, 1338, "Rechaza")
label(1700, 1440, "Cuenta corriente: sin tope")

# ---------------------------------------------------------------- capas
# archivos
tag("files", 345, 312, "Referencia por artículo (opcional)")
tag("files", 1215, 800, "Cotizaciones y comparación (opc.)")
tag("files", 2405, 990, "Orden de compra (opc.)")
tag("files", 2420, 1650, "Remito obligatorio · factura (opc.)")
tag("files", 2500, 834, "Factura (cta. cte.: el monto)")
# notificaciones
tag("notif", 345, 344, "Avisa al operativo (corrección)")
tag("notif", 345, 520, "Avisa al jefe")
tag("notif", 690, 962, "Avisa a Compras")
tag("notif", 1215, 830, "Avisa a Compras")
tag("notif", 1545, 315, "Avisa a quien emitió")
tag("notif", 1690, 1282, "Avisa a Gerencia")
tag("notif", 2185, 865, "Avisa a Compras")
tag("notif", 2405, 1022, "Avisa a Pañol")
tag("notif", 2235, 1576, "Avisa a Compras al recibir")
# reglas
tag("rules", 1215, 990, "Monto obligatorio · proveedor opcional")
tag("rules", 1495, 1095, "Sin cotización ni Gerencia · factura mensual")
tag("rules", 2010, 820, "Tope de Gerencia: $500.000 (configurable)")

# ================================================================ render
def esc(t): return html.escape(t, quote=False)
def tw(text, px, bold=False):  # ancho estimado de texto
    return len(text) * px * (0.58 if bold else 0.53)

def node_bbox(n): return (n["cx"] - n["w"] / 2, n["cy"] - n["h"] / 2, n["cx"] + n["w"] / 2, n["cy"] + n["h"] / 2)
def tag_bbox(t): return (t["x"], t["y"], t["x"] + t["w"], t["y"] + 26)
def label_bbox(l):
    w = tw(l["text"], 16) + 18
    return (l["cx"] - w / 2, l["cy"] - 12, l["cx"] + w / 2, l["cy"] + 12)

def render_nodes():
    out = []
    for n in nodes.values():
        lane = n["lane"]; stroke = LANES[lane][5]; fill = NODE_FILL[lane]
        x0, y0, x1, y1 = node_bbox(n); cx, cy, w, h = n["cx"], n["cy"], n["w"], n["h"]
        k = n["kind"]
        g = [f'<g class="node" id="{n["id"]}">']
        if k == "process":
            g.append(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="2.4"/>')
        elif k == "decision":
            g.append(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="3.2"/>')
            g.append(f'<rect x="{x0+7}" y="{y0+7}" width="{w-14}" height="{h-14}" rx="8" fill="none" stroke="{stroke}" stroke-width="1.2"/>')
        elif k == "diamond":
            g.append(f'<polygon points="{cx},{y0} {x1},{cy} {cx},{y1} {x0},{cy}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>')
        elif k == "chip":
            g.append(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="{h/2}" fill="{fill}" stroke="{stroke}" stroke-width="2.4"/>')
        elif k == "final_neg":
            g.append(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="{h/2}" fill="#F7E1E1" stroke="#B04A4A" stroke-width="2.4"/>')
        elif k == "final_ok":
            g.append(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="{h/2}" fill="#DDF0DF" stroke="#3F8A4F" stroke-width="2.4"/>')
        elif k == "pending":
            g.append(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="12" fill="#F6F6F4" stroke="#8A8F94" stroke-width="2.2" stroke-dasharray="9 6"/>')
        tcol = {"final_neg": "#6B1F1F", "final_ok": "#1E4D28", "pending": "#5E656B"}.get(k, "#1B2631")
        if k == "diamond":
            parts = n["title"].split(" ", 1)
            g.append(f'<text x="{cx}" y="{cy-4}" text-anchor="middle" font-size="21" font-weight="600" fill="{tcol}">{esc(parts[0])}</text>')
            g.append(f'<text x="{cx}" y="{cy+22}" text-anchor="middle" font-size="21" font-weight="600" fill="{tcol}">{esc(parts[1])}</text>')
        elif n["sub"] or n["state"]:
            lines = [(n["title"], 22, 600, tcol, "normal")]
            if n["sub"]: lines.append((n["sub"], 17, 400, "#46525E" if k != "pending" else "#6A7076", "normal"))
            if n["state"]: lines.append(("Estado: " + n["state"], 16, 400, "#66717C", "italic"))
            total = {1: 0, 2: 28, 3: 56}[len(lines)]
            y = cy - total / 2 + 7
            for (t, px, wt, col, st) in lines:
                g.append(f'<text x="{cx}" y="{y}" text-anchor="middle" font-size="{px}" font-weight="{wt}" fill="{col}" font-style="{st}">{esc(t)}</text>')
                y += 28
        else:
            g.append(f'<text x="{cx}" y="{cy + 8}" text-anchor="middle" font-size="22" font-weight="600" fill="{tcol}">{esc(n["title"])}</text>')
        g.append('</g>')
        out.append("".join(g))
    return "".join(out)

STYLE = {"main": ("#2F3B48", 3.2, ""), "alt": ("#6E7A86", 2.6, ""), "loop": ("#8C7B4E", 2.6, "10 7"), "pend": ("#9AA0A6", 2.4, "7 6")}
def render_edges():
    out = []
    for e in edges:
        col, wd, dash = STYLE[e["style"]]
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in e["pts"])
        da = f' stroke-dasharray="{dash}"' if dash else ""
        mk = ' marker-end="url(#ar)"' if e["end"] else ""
        out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{wd}"{da} stroke-linejoin="round"{mk}/>')
    return "".join(out)

def render_labels():
    out = []
    for l in labels:
        x0, y0, x1, y1 = label_bbox(l)
        out.append(f'<g class="lbl"><rect x="{x0:.1f}" y="{y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" rx="5" fill="#FFFFFF" fill-opacity="0.96"/>'
                   f'<text x="{l["cx"]}" y="{l["cy"]+5}" text-anchor="middle" font-size="16" font-weight="500" fill="#37424D">{esc(l["text"])}</text></g>')
    return "".join(out)

ICON = {
 "files": '<path d="M9.5 3.2 4 8.7a2.6 2.6 0 0 0 3.7 3.7l6.2-6.2a1.7 1.7 0 0 0-2.4-2.4L5.6 9.6" fill="none" stroke="#5B6770" stroke-width="1.6" stroke-linecap="round"/>',
 "notif": '<path d="M8 2.2c-2.3 0-3.6 1.7-3.6 4v2.3L3.2 10.6h9.6L11.6 8.5V6.2c0-2.3-1.3-4-3.6-4Z" fill="none" stroke="#5B6770" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.6 12.2a1.5 1.5 0 0 0 2.8 0" fill="none" stroke="#5B6770" stroke-width="1.5" stroke-linecap="round"/>',
 "rules": '<path d="M8 2 14 13H2Z" fill="none" stroke="#5B6770" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.2v3.2M8 11.2v.1" stroke="#5B6770" stroke-width="1.6" stroke-linecap="round"/>',
}
TAGFILL = {"files": "#FFFFFF", "notif": "#FFFFFF", "rules": "#FFF9E8"}
TAGSTROKE = {"files": "#9AA6B1", "notif": "#9AA6B1", "rules": "#C9A24A"}
def render_tags(kind):
    out = []
    for t in tags:
        if t["kind"] != kind: continue
        out.append(f'<g class="tag"><rect x="{t["x"]}" y="{t["y"]}" width="{t["w"]}" height="26" rx="7" fill="{TAGFILL[kind]}" stroke="{TAGSTROKE[kind]}" stroke-width="1.4"/>'
                   f'<g transform="translate({t["x"]+8},{t["y"]+5})">{ICON[kind]}</g>'
                   f'<text x="{t["x"]+30}" y="{t["y"]+18}" font-size="16" fill="#3A4651">{esc(t["text"])}</text></g>')
    return "".join(out)

def render_lanes():
    out = []
    for (name, lines, y0, y1, tint, stroke) in LANES:
        out.append(f'<rect x="150" y="{y0}" width="{W-150}" height="{y1-y0}" fill="{tint}" stroke="#C9D0D6" stroke-width="1.2"/>')
        out.append(f'<rect x="0" y="{y0}" width="150" height="{y1-y0}" fill="{stroke}" fill-opacity="0.92"/>')
        cy = (y0 + y1) / 2
        out.append(f'<text x="75" y="{cy-30}" text-anchor="middle" font-size="17" font-weight="700" fill="#FFFFFF" letter-spacing="0.4">{esc(name)}</text>')
        for i, ln in enumerate(lines):
            out.append(f'<text x="75" y="{cy+4+i*22}" text-anchor="middle" font-size="16" fill="#FFFFFF">{esc(ln)}</text>')
    return "".join(out)

def render_bottom():
    y = 1730
    o = []
    o.append(f'<rect x="40" y="{y}" width="860" height="268" rx="14" fill="#FFFFFF" stroke="#C9D0D6" stroke-width="1.6"/>')
    o.append(f'<text x="64" y="{y+36}" font-size="20" font-weight="700" fill="#1B2631">Cómo leerlo</text>')
    items = [
      ('<rect x="0" y="0" width="64" height="30" rx="8" fill="#DDE8F6" stroke="#5B7BA6" stroke-width="2.4"/>', "Paso (el color es el carril de quien actúa)"),
      ('<rect x="0" y="0" width="64" height="30" rx="8" fill="#E5DFF3" stroke="#7B6BA8" stroke-width="3.2"/><rect x="5" y="5" width="54" height="20" rx="5" fill="none" stroke="#7B6BA8" stroke-width="1.2"/>', "Decisión: aprueba, corrige o rechaza"),
      ('<path d="M0 15H56" stroke="#2F3B48" stroke-width="3.2" marker-end="url(#ar)"/>', "Camino principal"),
      ('<path d="M0 15H56" stroke="#6E7A86" stroke-width="2.6" marker-end="url(#ar)"/>', "Alternativa o salida"),
      ('<path d="M0 15H56" stroke="#8C7B4E" stroke-width="2.6" stroke-dasharray="10 7" marker-end="url(#ar)"/>', "Vuelta a corregir (conserva código e historial)"),
    ]
    for i, (svgp, text) in enumerate(items):
        yy = y + 58 + i * 34
        o.append(f'<g transform="translate(64,{yy})">{svgp}</g><text x="146" y="{yy+21}" font-size="17" fill="#37424D">{esc(text)}</text>')
    o.append(f'<rect x="560" y="{y+58}" width="64" height="30" rx="15" fill="#F7E1E1" stroke="#B04A4A" stroke-width="2.4"/><text x="640" y="{y+79}" font-size="17" fill="#37424D">Final negativo</text>')
    o.append(f'<rect x="560" y="{y+92}" width="64" height="30" rx="15" fill="#DDF0DF" stroke="#3F8A4F" stroke-width="2.4"/><text x="640" y="{y+113}" font-size="17" fill="#37424D">Final correcto</text>')
    o.append(f'<rect x="560" y="{y+126}" width="64" height="30" rx="8" fill="#F6F6F4" stroke="#8A8F94" stroke-width="2.2" stroke-dasharray="9 6"/><text x="640" y="{y+147}" font-size="17" fill="#37424D">Pendiente de desarrollo</text>')
    names = {"files": "Archivos que se cargan", "notif": "Quién recibe el aviso", "rules": "Regla importante"}
    for i, kind in enumerate(["files", "notif", "rules"]):
        yy = y + 166 + i * 28
        o.append(f'<rect x="560" y="{yy}" width="64" height="22" rx="6" fill="{TAGFILL[kind]}" stroke="{TAGSTROKE[kind]}" stroke-width="1.4"/><g transform="translate(584,{yy+3}) scale(0.9)">{ICON[kind]}</g><text x="640" y="{yy+17}" font-size="17" fill="#37424D">{names[kind]}</text>')
    vx = 940
    o.append(f'<rect x="{vx}" y="{y}" width="980" height="268" rx="14" fill="#FFFFFF" stroke="#C9D0D6" stroke-width="1.6"/>')
    o.append(f'<text x="{vx+24}" y="{y+36}" font-size="20" font-weight="700" fill="#1B2631">Quién ve la SIC</text>')
    vis = [
      ("Operativo", "Las suyas y todas las de su área (solo lectura de las ajenas)."),
      ("Jefe de área", "Todas las de su área, en cualquier estado."),
      ("Pañol", "Todas las SIC de todas las áreas; recibe para cualquier área."),
      ("Compras y Gerencia", "Todas las SIC de la empresa."),
      ("Administrador", "Todo, además de la configuración del sistema."),
    ]
    for i, (who, what) in enumerate(vis):
        yy = y + 76 + i * 34
        o.append(f'<text x="{vx+24}" y="{yy}" font-size="17" font-weight="600" fill="#1B2631">{esc(who)}</text><text x="{vx+250}" y="{yy}" font-size="17" fill="#46525E">{esc(what)}</text>')
    ax = 1960
    o.append(f'<rect x="{ax}" y="{y}" width="950" height="268" rx="14" fill="#FFFFFF" stroke="#C9D0D6" stroke-width="1.6"/>')
    o.append(f'<text x="{ax+24}" y="{y+36}" font-size="20" font-weight="700" fill="#1B2631">Anulación y reglas generales</text>')
    o.append(f'<rect x="{ax+24}" y="{y+52}" width="130" height="38" rx="19" fill="#F7E1E1" stroke="#B04A4A" stroke-width="2.4"/><text x="{ax+89}" y="{y+78}" text-anchor="middle" font-size="19" font-weight="600" fill="#6B1F1F">Anulada</text>')
    rules = [
      "Quien emitió la SIC puede anularla hasta que Compras la acepta.",
      "Compras puede anularla en cualquier momento, salvo si ya está cerrada.",
      "La anulación y los rechazos exigen un motivo, que queda en el historial.",
      "El rechazo es definitivo; para seguir, se emite una SIC nueva.",
      "Compra directa o cuenta corriente: Compras puede volver a compra normal hasta emitir la orden.",
      "Certificados de calidad: Compras los sube al llegar, incluso con la SIC cerrada.",
    ]
    for i, r in enumerate(rules):
        o.append(f'<text x="{ax+24}" y="{y+118+i*25}" font-size="17" fill="#46525E">• {esc(r)}</text>')
    return "".join(o)

def build_svg():
    head = (f'<svg id="flow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="{FONT}" role="img" '
            f'aria-label="Flujograma completo de una SIC">'
            '<title>Flujo completo de una solicitud interna de compra (SIC)</title>'
            '<desc>Recorrido de una SIC por los carriles Emisor, Jefe de área, Compras, Gerencia y Pañol, con sus correcciones, rechazos, tipos de compra, anulación y cierre.</desc>'
            '<defs><marker id="ar" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            '<path d="M1.5 1.2L8.5 5L1.5 8.8" fill="none" stroke="context-stroke" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>'
            f'<rect x="0" y="0" width="{W}" height="{H}" fill="#FFFFFF"/>')
    title = ('<text x="40" y="52" font-size="34" font-weight="700" fill="#1B2631">Flujo completo de una SIC</text>'
             '<text x="40" y="86" font-size="19" fill="#55616C">Sistema de Compras · Servicios Industriales · de la solicitud al cierre, con sus correcciones, rechazos y tipos de compra</text>')
    body = (title + render_lanes() + render_edges() + render_nodes() + render_labels() +
            '<g id="layer-files">' + render_tags("files") + '</g>' +
            '<g id="layer-notif">' + render_tags("notif") + '</g>' +
            '<g id="layer-rules">' + render_tags("rules") + '</g>' + render_bottom())
    return head + body + '</svg>'

# ================================================================ chequeos
def seg_rect_hit(p, q, r, shrink=3):
    x0, y0, x1, y1 = r[0] + shrink, r[1] + shrink, r[2] - shrink, r[3] - shrink
    (ax, ay), (bx, by) = p, q
    sx0, sx1 = min(ax, bx), max(ax, bx); sy0, sy1 = min(ay, by), max(ay, by)
    return sx0 < x1 and sx1 > x0 and sy0 < y1 and sy1 > y0

def rect_hit(a, b, pad=0):
    return a[0] < b[2] + pad and a[2] > b[0] - pad and a[1] < b[3] + pad and a[3] > b[1] - pad

def run_checks():
    problems = []
    nb = {k: node_bbox(n) for k, n in nodes.items()}
    tb = [(t["text"], tag_bbox(t)) for t in tags]
    lb = [(l["text"], label_bbox(l)) for l in labels]
    for k, b in nb.items():
        if b[0] < 150 or b[2] > W or b[1] < 120 or b[3] > 1700: problems.append(f"nodo fuera de zona: {k} {b}")
    for t, b in tb + lb:
        if b[0] < 150 or b[2] > W: problems.append(f"rótulo fuera de lienzo: {t} {b}")
    ks = list(nb)
    for i in range(len(ks)):
        for j in range(i + 1, len(ks)):
            if rect_hit(nb[ks[i]], nb[ks[j]], 8): problems.append(f"nodos pegados/superpuestos: {ks[i]} {ks[j]}")
    for t, b in tb:
        for k, nbb in nb.items():
            if rect_hit(b, nbb, 4): problems.append(f"tag '{t}' toca nodo {k}")
    for i in range(len(tb)):
        for j in range(i + 1, len(tb)):
            if rect_hit(tb[i][1], tb[j][1], 4): problems.append(f"tags superpuestos: {tb[i][0]} / {tb[j][0]}")
    for t, b in lb:
        for k, nbb in nb.items():
            if rect_hit(b, nbb, 2): problems.append(f"rótulo '{t}' toca nodo {k}")
        for t2, b2 in tb:
            if rect_hit(b, b2, 2): problems.append(f"rótulo '{t}' toca tag '{t2}'")
    for i in range(len(lb)):
        for j in range(i + 1, len(lb)):
            if rect_hit(lb[i][1], lb[j][1], 2): problems.append(f"rótulos superpuestos: {lb[i][0]} / {lb[j][0]}")
    segs = []
    for ei, e in enumerate(edges):
        for a, b in zip(e["pts"], e["pts"][1:]):
            segs.append((ei, a, b))
            for k, nbb in nb.items():
                if seg_rect_hit(a, b, nbb, 3): problems.append(f"flecha {ei} cruza nodo {k} en {a}->{b}")
            for t, tbb in tb:
                if seg_rect_hit(a, b, tbb, 1): problems.append(f"flecha {ei} cruza tag '{t}' en {a}->{b}")
    def horiz(s): return abs(s[1][1] - s[2][1]) < 0.1
    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            si, sj = segs[i], segs[j]
            if si[0] == sj[0]: continue
            if horiz(si) == horiz(sj): continue
            h, v = (si, sj) if horiz(si) else (sj, si)
            hy = h[1][1]; vx = v[1][0]
            hx0, hx1 = sorted((h[1][0], h[2][0])); vy0, vy1 = sorted((v[1][1], v[2][1]))
            if hx0 + 1 < vx < hx1 - 1 and vy0 + 1 < hy < vy1 - 1:
                problems.append(f"cruce de flechas {si[0]}/{sj[0]} en ({vx},{hy})")
    for k, n in nodes.items():
        if n["kind"] == "diamond":
            continue
        avail = n["w"] - 26
        for text, px, bold in [(n["title"], 22, True), (n["sub"] or "", 17, False), ("Estado: " + n["state"] if n["state"] else "", 16, False)]:
            if text and tw(text, px, bold) > avail: problems.append(f"texto largo en {k}: '{text}' ~{tw(text,px,bold):.0f}>{avail}")
    for t in tags:
        if tw(t["text"], 16) + 40 > t["w"]: problems.append(f"tag angosto: '{t['text']}' ~{tw(t['text'],15)+40:.0f}>{t['w']}")
    return problems

if __name__ == "__main__":
    p = run_checks()
    print("PROBLEMAS:", len(p))
    for x in p: print(" -", x)
    open("flow.svg", "w").write(build_svg())
