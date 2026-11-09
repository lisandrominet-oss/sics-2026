"use client";

export default function PrintBar({ projectId, bays, current }: { projectId: string; bays: { id: string; name: string }[]; current: string | null }) {
  return (
    <div className="cal-bar">
      <button type="button" onClick={() => window.print()}>Imprimir</button>
      <span>Hoja A4 horizontal · márgenes predeterminados · desactivar encabezados y pies del navegador.</span>
      {current && <a href={`/calidad/${projectId}/imprimir`}>Todos los sectores</a>}
      {bays.filter((b) => b.id !== current).map((b) => (
        <a key={b.id} href={`/calidad/${projectId}/imprimir?bahia=${b.id}`}>Solo {b.name}</a>
      ))}
      <a href={current ? `/calidad/${projectId}?bahia=${current}` : `/calidad/${projectId}`}>Volver al proyecto</a>
    </div>
  );
}
