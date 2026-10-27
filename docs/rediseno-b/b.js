/* Armado compartido de B: menú, barra superior, tema claro/oscuro y aviso (toast). Solo maqueta. */
(function(){
  const q = new URLSearchParams(location.search).get("tema");
  let t = q;
  try { t = t || localStorage.getItem("b-tema"); } catch (e) {}
  if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
  document.documentElement.dataset.theme = t === "oscuro" ? "dark" : "light";
})();

window.B = {
  toggleTema(){
    const d = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = d;
    try { localStorage.setItem("b-tema", d === "dark" ? "oscuro" : "claro"); } catch (e) {}
    document.querySelectorAll("[data-tema-ico]").forEach((el) => (el.innerHTML = ico(d === "dark" ? "sol" : "luna", 18)));
  },
  toast(msg){
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = ico("check", 16) + "<span>" + msg + "</span>";
    el.classList.add("ve"); clearTimeout(this._t); this._t = setTimeout(() => el.classList.remove("ve"), 2600);
  },
  shell(activo, tituloM, accionM, volver){
    const it = (i, t, k, href, n) => `<a class="it" href="${href}" ${activo === k ? 'aria-current="page"' : ""}>${ico(i, 18)}${t}${n ? `<span class="n" aria-label="${n} esperan tu firma">${n}</span>` : ""}</a>`;
    const dark = document.documentElement.dataset.theme === "dark";
    const logo = `<a class="logo" href="b-tablero.html" aria-label="Servicios Industriales, SICS"><img class="pos" src="img/logo-completo-color.svg" alt=""><img class="neg" src="img/logo-completo-negativo.svg" alt=""></a>`;
    document.body.insertAdjacentHTML("afterbegin", `
      <div class="app">
        <aside class="lado">${logo}
          <div class="grp">Principal</div>${it("tablero", "Tablero", "tablero", "b-tablero.html", MIAS.length)}${it("nueva", "Nueva SIC", "nueva", "b-nueva.html")}
          <div class="grp">Compras</div>${it("proveedores", "Proveedores", "prov", "#")}${it("doc", "Catálogo", "cat", "#")}
          <div class="grp">Módulos</div>${it("personal", "Personal", "pers", "#")}
          <div class="yo"><span class="av yo">VS</span><div><b>Valeria Sosa</b><span>Jefe de área</span></div></div>
        </aside>
        <header class="top">
          <label class="buscar">${ico("buscar", 16)}<input type="search" placeholder="Buscar una SIC, un proveedor o un artículo" aria-label="Buscar"><kbd>Ctrl K</kbd></label>
          <div class="der"><button class="icb" type="button" aria-label="Cambiar tema" data-tema-ico onclick="B.toggleTema()">${ico(dark ? "sol" : "luna", 18)}</button><button class="icb" type="button" aria-label="Avisos, 3 sin leer">${ico("aviso", 18)}<i></i></button></div>
        </header>
        <div class="mtop">${volver ? `<a class="icb" href="${volver}" aria-label="Volver">${ico("volver", 22)}</a>` : `<button class="icb" type="button" aria-label="Abrir menú">${ico("menu", 22)}</button>`}<img src="img/isotipo-color.svg" alt="" aria-hidden="true"><span style="display:flex">${accionM || ""}<button class="icb" type="button" aria-label="Cambiar tema" data-tema-ico onclick="B.toggleTema()">${ico(dark ? "sol" : "luna", 20)}</button></span></div>
        <main class="hoja" id="hoja"></main>
      </div>`);
    return document.getElementById("hoja");
  },
};
