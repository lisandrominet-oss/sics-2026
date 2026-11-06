"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Button from "@/components/ui/Button";

export type SignaturePadHandle = { toBlob: () => Promise<Blob | null>; isEmpty: () => boolean; clear: () => void };

// Firma manuscrita con <canvas> propio (sin librerías). Funciona con dedo, lápiz y mouse.
const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void; disabled?: boolean }>(function SignaturePad(
  { onChange, disabled },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [empty, setEmpty] = useState(true);

  // El lienzo se ajusta al ancho disponible y a la densidad de pantalla.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const { width, height } = canvas.getBoundingClientRect();
      if (!width) return;
      const prev = dirty.current ? canvas.toDataURL() : null;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "black"; // la firma se imprime en blanco y negro, igual en claro y oscuro
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, width, height);
        img.src = prev;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    if (!dirty.current) {
      dirty.current = true;
      setEmpty(false);
      onChange?.(false);
    }
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    dirty.current = false;
    setEmpty(true);
    onChange?.(true);
  }

  useImperativeHandle(ref, () => ({
    isEmpty: () => !dirty.current,
    clear,
    // PNG con fondo blanco para que se vea igual en el remito impreso.
    toBlob: () =>
      new Promise((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas || !dirty.current) return resolve(null);
        const out = document.createElement("canvas");
        out.width = canvas.width;
        out.height = canvas.height;
        const ctx = out.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, 0, 0);
        out.toBlob((b) => resolve(b), "image/png");
      }),
  }));

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Zona para firmar"
        className="h-40 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">{empty ? "Firmá con el dedo o el mouse." : "Firma lista para guardar."}</p>
        <Button variant="link" size="sm" onClick={clear} disabled={empty || disabled}>Borrar firma</Button>
      </div>
    </div>
  );
});

export default SignaturePad;
