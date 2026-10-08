# -*- coding: utf-8 -*-
import html, importlib.util, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, ".."))
spec = importlib.util.spec_from_file_location("build", os.path.join(HERE, "build.py")); b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
assert not b.run_checks(), "hay problemas de layout"
svg = b.build_svg()
e = html.escape

ROWS = [
 ("1", "Emisión de la SIC", "Pendiente del jefe (si emite un operativo o el Pañol) · Enviada (si emite un jefe, Compras, Gerencia o admin)",
  "Operativo, Pañol o jefe de área", "Asunto, proyecto, fecha límite y artículos (cantidad, especificaciones, link). Archivo de referencia por artículo (opcional). Marca de certificado de calidad por artículo.",
  "Al jefe del área, o directo a Compras si no emite un operativo ni el Pañol."),
 ("2", "Decisión del jefe", "Pendiente del jefe → Enviada · En observación · Rechazada por el jefe",
  "Cualquier jefe del área de la SIC (y admin)", "Aprobar, pedir corrección o rechazar la SIC entera, o revisar artículo por artículo (aprobar, observar o rechazar cada uno). El comentario es obligatorio al corregir o rechazar.",
  "Aprueba: pasa a Compras. Corrección: vuelve al operativo, que edita y reenvía (vuelve a pasar por el jefe). Rechazo: final, definitivo. Por artículo: los aprobados siguen; los observados pasan a una SIC nueva vinculada, que vuelve al operativo; los rechazados quedan tachados y no se compran."),
 ("3", "Revisión de Compras", "Enviada → En cotización · En observación · Rechazada por Compras · Aprobada",
  "Compras", "Aceptar, pedir corrección o rechazar, con comentario. Elige el tipo de compra: normal, directa (monto obligatorio, proveedor opcional) o cuenta corriente (proveedor habilitado).",
  "Normal: cotización. Directa: compara el monto con el tope. Cuenta corriente: directo a aprobada. Corrección: vuelve al operativo, que reenvía al jefe (si la emitió un jefe, vuelve a Compras). Rechazo: final. Compras también puede revisar artículo por artículo, con la misma regla: los observados pasan a una SIC nueva y los rechazados no se compran."),
 ("4", "Cotización", "En cotización → Pendiente de validación técnica",
  "Compras", "Monto final (obligatorio). Cotizaciones y comparación de precios: opcionales.",
  "Validación técnica."),
 ("5", "Validación técnica", "Pendiente de validación → Aprobada · Pendiente Gerencia · En cotización",
  "Quien emitió la SIC o un jefe de su área (y admin)", "Aprobar o pedir corrección, con comentario.",
  "Si el monto supera el tope de Gerencia ($500.000, configurable): Gerencia. Si no: aprobada. Corrección: vuelve a cotizar."),
 ("6", "Decisión de Gerencia", "Pendiente Gerencia → Aprobada · Rechazada por Gerencia",
  "Gerencia (y admin)", "Aprobar o rechazar, con comentario.",
  "Aprueba: orden de compra. Rechazo: final, definitivo."),
 ("7", "Orden de compra", "Aprobada → Orden emitida",
  "Compras", "Número de orden y archivo de la orden (opcionales). Hasta emitirla, una compra directa o de cuenta corriente puede volver a compra normal.",
  "Pañol: recepción."),
 ("8", "Recepción", "Orden emitida → Recibida (si es parcial, sigue abierta)",
  "Pañol, para cualquier área (y admin)", "Remito (obligatorio), factura (opcional) y cantidad recibida por artículo.",
  "Compras: cierre."),
 ("9", "Cierre", "Recibida → Cerrada",
  "Compras", "Factura (obligatoria). En cuenta corriente: el monto de la compra, sin factura por SIC.",
  "Final correcto. En cuenta corriente: después, liquidación mensual (todavía no desarrollada)."),
 ("—", "Anulación", "Cualquier estado → Anulada",
  "Quien emitió la SIC, hasta que Compras la acepta · Compras, en cualquier momento salvo si está cerrada", "Motivo obligatorio (queda en el historial).",
  "Final."),
]
rows_html = "".join(f"<tr><td class='n'>{e(a)}</td><td><b>{e(t)}</b></td><td>{e(es)}</td><td>{e(w)}</td><td>{e(d)}</td><td>{e(nx)}</td></tr>" for a, t, es, w, d, nx in ROWS)

HTML = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flujo completo de una SIC · Sistema de Compras</title>
<style>
  :root {{ --ink:#1B2631; --muted:#55616C; --line:#D5DBE1; --bg:#F4F6F8; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family:{b.FONT}; color:var(--ink); background:var(--bg); }}
  header.bar {{ position:sticky; top:0; z-index:5; display:flex; flex-wrap:wrap; gap:10px 18px; align-items:center;
    padding:10px 20px; background:#fff; border-bottom:1px solid var(--line); }}
  header.bar h1 {{ font-size:17px; margin:0 12px 0 0; font-weight:700; }}
  .group {{ display:flex; gap:6px; align-items:center; }}
  .group > span {{ font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-right:2px; }}
  button.t {{ font:inherit; font-size:13px; padding:6px 11px; border:1px solid #B9C2CB; background:#fff; border-radius:8px; cursor:pointer; color:var(--ink); }}
  button.t[aria-pressed="true"] {{ background:#1B2631; color:#fff; border-color:#1B2631; }}
  button.t:hover {{ border-color:#1B2631; }}
  #viewport {{ overflow:auto; height:calc(100vh - 118px); background:#fff; cursor:grab; }}
  #viewport.drag {{ cursor:grabbing; user-select:none; }}
  #flow {{ display:block; }}
  section.resumen {{ padding:28px 24px 60px; max-width:1500px; margin:0 auto; }}
  section.resumen h2 {{ font-size:22px; margin:0 0 6px; }}
  section.resumen p.lead {{ color:var(--muted); margin:0 0 16px; font-size:14px; }}
  table {{ width:100%; border-collapse:collapse; background:#fff; font-size:13px; line-height:1.4; }}
  th, td {{ border:1px solid var(--line); padding:8px 10px; vertical-align:top; text-align:left; }}
  th {{ background:#EEF1F4; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:#3a4651; }}
  td.n {{ text-align:center; width:34px; font-weight:700; }}
  .hide-files #layer-files, .hide-notif #layer-notif, .hide-rules #layer-rules {{ display:none; }}
  .hint {{ font-size:12px; color:var(--muted); }}
  @page {{ size: A3 landscape; margin: 7mm; }}
  @media print {{
    body {{ background:#fff; }}
    header.bar, .hint {{ display:none !important; }}
    #viewport {{ overflow:visible; height:auto; cursor:auto; }}
    #flow {{ width:100% !important; height:auto !important; display:block; }}
    #layer-files, #layer-notif, #layer-rules {{ display:inline !important; }}
    section.resumen {{ page-break-before:always; padding:0; max-width:none; }}
    table {{ font-size:11.5px; }}
    tr {{ page-break-inside:avoid; }}
  }}
</style></head>
<body>
<header class="bar">
  <h1>Flujo completo de una SIC</h1>
  <div class="group"><span>Capas</span>
    <button class="t" data-layer="files" aria-pressed="true">Archivos</button>
    <button class="t" data-layer="notif" aria-pressed="true">Avisos</button>
    <button class="t" data-layer="rules" aria-pressed="true">Reglas</button>
  </div>
  <div class="group"><span>Zoom</span>
    <button class="t" id="zout" aria-label="Alejar">−</button>
    <button class="t" id="zin" aria-label="Acercar">+</button>
    <button class="t" id="zfit">Ajustar al ancho</button>
    <button class="t" id="z100">100%</button>
  </div>
  <div class="group"><button class="t" id="print">Imprimir o guardar PDF (A3)</button></div>
  <span class="hint">Arrastrá para moverte · Ctrl + rueda para el zoom</span>
</header>
<div id="viewport">{svg}</div>
<section class="resumen">
  <h2>Resumen paso a paso</h2>
  <p class="lead">Qué estado tiene la SIC, quién actúa, qué se carga y a dónde va después. Versión del 8 de octubre de 2026.</p>
  <table>
    <thead><tr><th>#</th><th>Paso</th><th>Estado</th><th>Quién actúa</th><th>Qué se carga</th><th>A dónde va después</th></tr></thead>
    <tbody>{rows_html}</tbody>
  </table>
</section>
<script>
(function() {{
  var svg = document.getElementById('flow'), vp = document.getElementById('viewport');
  var BASE = {b.W}, zoom = 1;
  function apply() {{ svg.style.width = (BASE * zoom) + 'px'; svg.style.height = (BASE * zoom * {b.H} / {b.W}) + 'px'; }}
  function fit() {{ zoom = Math.max(0.2, (vp.clientWidth - 2) / BASE); apply(); vp.scrollLeft = 0; vp.scrollTop = 0; }}
  function setZoom(z, cx, cy) {{
    var old = zoom; zoom = Math.min(2.5, Math.max(0.2, z)); apply();
    var r = zoom / old; vp.scrollLeft = (vp.scrollLeft + cx) * r - cx; vp.scrollTop = (vp.scrollTop + cy) * r - cy;
  }}
  document.getElementById('zin').onclick = function() {{ setZoom(zoom * 1.25, vp.clientWidth / 2, vp.clientHeight / 2); }};
  document.getElementById('zout').onclick = function() {{ setZoom(zoom / 1.25, vp.clientWidth / 2, vp.clientHeight / 2); }};
  document.getElementById('zfit').onclick = fit;
  document.getElementById('z100').onclick = function() {{ setZoom(1, vp.clientWidth / 2, vp.clientHeight / 2); }};
  document.getElementById('print').onclick = function() {{ window.print(); }};
  vp.addEventListener('wheel', function(ev) {{
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    var rect = vp.getBoundingClientRect();
    setZoom(zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), ev.clientX - rect.left, ev.clientY - rect.top);
  }}, {{ passive: false }});
  var drag = null;
  vp.addEventListener('mousedown', function(ev) {{ drag = {{ x: ev.clientX, y: ev.clientY, l: vp.scrollLeft, t: vp.scrollTop }}; vp.classList.add('drag'); }});
  window.addEventListener('mouseup', function() {{ drag = null; vp.classList.remove('drag'); }});
  window.addEventListener('mousemove', function(ev) {{ if (!drag) return; vp.scrollLeft = drag.l - (ev.clientX - drag.x); vp.scrollTop = drag.t - (ev.clientY - drag.y); }});
  document.querySelectorAll('button[data-layer]').forEach(function(btn) {{
    btn.onclick = function() {{
      var on = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', on ? 'false' : 'true');
      document.body.classList.toggle('hide-' + btn.dataset.layer, on);
    }};
  }});
  window.addEventListener('resize', fit);
  fit();
}})();
</script>
</body></html>"""
open(os.path.join(OUT, "flujograma-sic.html"), "w").write(HTML)
open(os.path.join(OUT, "flujograma-sic.svg"), "w").write(svg)
print("ok", len(HTML))
