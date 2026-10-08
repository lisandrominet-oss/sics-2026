# 004 — Acordeones de Contratos

- **Status**: TODO
- **Commit**: 7b9c50e
- **Severity**: MEDIUM
- **Category**: Easing y duración / Interruptibilidad / Physicality
- **Estimated scope**: 2 archivos

## Problem
```tsx
// components/ContractsList.tsx:403-411
function CollapsibleRows({ id, open, className = "", children }: ...) {
  return (
    <div id={id} className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} ${className}`}>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
// ContractsList.tsx:489
<IconChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
// components/ContractDetail.tsx:173-185
function CollapsiblePanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className="col-span-full grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
      <div className="overflow-hidden">
        <div className="py-3">{open ? children : null}</div>
      </div>
    </div>
  );
}
// ContractDetail.tsx:1109
className={`h-4 w-4 transition-transform duration-300 ${isDetailOpen ? "rotate-180" : ""}`}
```
`ease-in-out` nativo es débil y 300 ms es lento. En `ContractDetail`, al cerrar, `open ? children : null` quita el contenido de golpe: lo que se anima es una caja vacía encogiéndose. (El desmontaje es intencional: resetea los formularios `InvoiceForm`/`RegisterPaymentForm`.)

## Target
- Curva `drawer` (`ease-drawer`, token del plan 001: `cubic-bezier(0.32, 0.72, 0, 1)`), abrir `duration-open` (240 ms), cerrar `duration-close` (160 ms), también en los chevrons:
```tsx
`grid transition-[grid-template-rows] ease-drawer ${open ? "grid-rows-[1fr] duration-open" : "grid-rows-[0fr] duration-close"} ...`
`... transition-transform ease-drawer ${open ? "rotate-180 duration-open" : "duration-close"}`
```
- `CollapsiblePanel`: el contenido se mantiene montado mientras dura el cierre y se desmonta después:
```tsx
const [mounted, setMounted] = useState(open);
useEffect(() => {
  if (open) { setMounted(true); return; }
  const t = setTimeout(() => setMounted(false), 200); // un poco más que `close` (160 ms)
  return () => clearTimeout(t);
}, [open]);
// ...<div className="py-3">{mounted ? children : null}</div>
```
Si se vuelve a abrir antes de los 200 ms el temporizador se cancela y no se pierde el contenido.

## Repo conventions to follow
Los tokens `ease-drawer`, `duration-open`, `duration-close` salen del plan 001. Se acepta animar `grid-template-rows` (no hay alternativa solo-`transform` para altura automática y el contenido es liviano).

## Steps
1. `ContractsList.tsx`: `CollapsibleRows` y el chevron (línea 489).
2. `ContractDetail.tsx`: `CollapsiblePanel` con montaje diferido y el chevron (línea 1109); importar `useEffect`/`useState` si falta.

## Boundaries
No cambiar qué formularios se muestran ni cuándo se resetean al terminar (`onDone`); el contenido debe quedar desmontado al final del cierre. No tocar RPC ni lógica de datos.

## Verification
- **Mecánica**: `tsc` = 83.
- **Feel check**: abrir/cerrar varias veces seguidas una tarjeta de dinero y un panel de cuota: se retargetea sin saltar; al cerrar se ve el contenido colapsar (no una caja vacía); el chevron gira junto con el panel; cerrar es más rápido que abrir. Registrar un pago/factura de prueba **no** (producción): se prueba con página temporal de datos falsos.
- **Done when**: ningún acordeón usa `ease-in-out` ni 300 ms.
