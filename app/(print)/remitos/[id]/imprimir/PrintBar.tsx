"use client";

export default function PrintBar({ dup, id }: { dup: boolean; id: string }) {
  return (
    <div className="rem-bar">
      <button type="button" onClick={() => window.print()}>Imprimir</button>
      <span>Hoja A4 horizontal · márgenes predeterminados · desactivar encabezados y pies del navegador.</span>
      <a href={dup ? `/remitos/${id}/imprimir` : `/remitos/${id}/imprimir?dup=1`}>{dup ? "Ver sin duplicado" : "Ver con duplicado"}</a>
      <a href={`/remitos/${id}`}>Volver al despacho</a>
    </div>
  );
}
