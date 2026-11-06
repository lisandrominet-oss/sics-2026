"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { inputClass, numClass } from "@/lib/ui";
import { fmtQty, untyped } from "@/lib/remitos";

export type ReceiveLine = { id: string; code: string; description: string; unit: string; qty: number };

// El pañolero de proyecto confirma qué llegó de cada línea. Lo que no llegó, o llegó de menos, queda
// registrado como diferencia y el stock en obra refleja lo realmente recibido (el del taller no cambia).
export default function RemitoReceiveForm({ dispatchId, lines }: { dispatchId: string; lines: ReceiveLine[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const supabase = useMemo(() => untyped(createClient()), []);
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.id, String(l.qty)])));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = lines.map((l) => {
    const raw = (qty[l.id] ?? "").replace(",", ".");
    const n = raw === "" ? NaN : Number(raw);
    return { line: l, n, invalid: Number.isNaN(n) || n < 0 || n > l.qty };
  });
  const invalid = parsed.some((p) => p.invalid);
  const diffs = parsed.filter((p) => !p.invalid && p.n !== p.line.qty);

  async function submit() {
    if (invalid) return notify.error("Revisá las cantidades: tienen que estar entre 0 y lo enviado");
    const ok = await confirm({
      title: diffs.length ? "Confirmar la recepción con diferencias" : "Confirmar la recepción",
      description: diffs.length
        ? `Hay ${diffs.length} ${diffs.length === 1 ? "línea" : "líneas"} con diferencias. Queda registrado y el stock en obra refleja lo recibido. No se puede deshacer.`
        : "Todo llegó completo. Queda registrado y no se puede deshacer.",
      confirmLabel: "Confirmar recepción",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc("remito_receive_dispatch", {
      p_dispatch_id: dispatchId,
      p_lines: parsed.map((p) => ({ line_id: p.line.id, received_qty: p.n, note: notes[p.line.id] ?? "" })),
      p_note: note,
    });
    setBusy(false);
    if (error) return notify.error("No se pudo registrar la recepción", error.message);
    notify.success(diffs.length ? "Recepción registrada con diferencias" : "Recepción registrada");
    router.refresh();
  }

  return (
    <Card title="Recibir en obra">
      <p className="text-sm text-slate-500">Indicá cuánto llegó de cada línea. «No llegó» pone 0.</p>
      <ul className="mt-4 space-y-3">
        {parsed.map(({ line, n, invalid: bad }) => {
          const short = !bad && n !== line.qty;
          return (
            <li key={line.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm">
                <span className={`mr-2 font-medium text-slate-900 ${numClass}`}>{line.code}</span>
                <span className="text-slate-700">{line.description}</span>
                <span className={`ml-2 text-xs text-slate-500 ${numClass}`}>Enviado: {fmtQty(line.qty)} {line.unit}</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Recibido" error={bad ? `Entre 0 y ${fmtQty(line.qty)}` : null}>
                  {(p) => (
                    <input {...p} type="number" min="0" max={line.qty} step="0.01" inputMode="decimal" value={qty[line.id] ?? ""}
                      onChange={(e) => setQty({ ...qty, [line.id]: e.target.value })} className={inputClass} />
                  )}
                </Field>
                <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
                  <Button variant="secondary" size="sm" onClick={() => setQty({ ...qty, [line.id]: String(line.qty) })}>Llegó todo</Button>
                  <Button variant="secondary" size="sm" onClick={() => setQty({ ...qty, [line.id]: "0" })}>No llegó</Button>
                </div>
                <Field label={short ? "Qué pasó (opcional)" : "Nota (opcional)"} className="col-span-2">
                  {(p) => <input {...p} value={notes[line.id] ?? ""} onChange={(e) => setNotes({ ...notes, [line.id]: e.target.value })} className={inputClass} />}
                </Field>
              </div>
            </li>
          );
        })}
      </ul>
      <Field label="Nota general (opcional)" className="mt-4">
        {(p) => <textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />}
      </Field>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button loading={busy} disabled={invalid} onClick={submit}>Confirmar recepción</Button>
        {diffs.length > 0 && <span className="text-sm text-slate-600">{diffs.length} {diffs.length === 1 ? "línea con diferencia" : "líneas con diferencias"}</span>}
      </div>
    </Card>
  );
}
