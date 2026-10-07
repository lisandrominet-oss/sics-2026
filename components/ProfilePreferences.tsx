"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import ThemeSelector from "@/components/ThemeSelector";
import UserAvatar, { AVATAR_EVENT, clearAvatarCache, setAvatarCache } from "@/components/UserAvatar";
import InfoItem from "@/components/ui/InfoItem";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const AVATAR_SIZE = 256;

async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", 0.85)
  );
}

function announce(url: string | null) {
  window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { url } }));
}

export default function ProfilePreferences({
  userId,
  fullName,
  email,
  roleLabel,
  department,
  plantName,
  avatarPath,
}: {
  userId: string;
  fullName: string | null;
  email: string;
  roleLabel: string;
  department: string | null;
  plantName: string | null;
  avatarPath: string | null;
}) {
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(avatarPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Elegí un archivo de imagen (JPG, PNG o WebP).");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("La imagen es demasiado grande (máximo 25 MB).");
      return;
    }
    setBusy(true);
    try {
      const blob = await toSquareJpeg(file).catch(() => {
        throw new Error("No se pudo leer la imagen. Probá con otra foto en formato JPG, PNG o WebP.");
      });
      const supabase = createClient();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw new Error(upErr.message);
      const { error: rpcErr } = await supabase.rpc("set_my_avatar", { p_path: path });
      if (rpcErr) {
        await supabase.storage.from("avatars").remove([path]);
        throw new Error(rpcErr.message);
      }
      if (currentPath) await supabase.storage.from("avatars").remove([currentPath]);
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      setCurrentPath(path);
      if (data?.signedUrl) {
        setAvatarCache(userId, data.signedUrl);
        announce(data.signedUrl);
      }
      notify.success("Foto de perfil actualizada");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la foto");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (!currentPath) return;
    if (
      !(await confirm({
        title: "¿Quitar tu foto de perfil?",
        confirmLabel: "Quitar foto",
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcErr } = await supabase.rpc("set_my_avatar", { p_path: null });
    if (rpcErr) {
      setError(rpcErr.message);
      setBusy(false);
      return;
    }
    await supabase.storage.from("avatars").remove([currentPath]);
    setCurrentPath(null);
    clearAvatarCache(userId);
    announce(null);
    notify.success("Foto de perfil eliminada");
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <section className={cardClass({ padding: "lg" })}>
        <h2 className="text-sm font-semibold text-slate-900">Perfil</h2>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <UserAvatar userId={userId} fullName={fullName} size="h-24 w-24" text="text-2xl" />
          <div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              <Button onClick={() => inputRef.current?.click()} loading={busy}>
                {busy ? "Guardando…" : currentPath ? "Cambiar foto" : "Subir foto"}
              </Button>
              {currentPath && (
                <Button variant="secondary" onClick={removePhoto} disabled={busy}>
                  Quitar foto
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Opcional. Desde el celular podés sacarla en el momento. Solo la ves vos.
            </p>
            {error && <p role="alert" className="animate-shake mt-2 text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <InfoItem definition label="Nombre" value={fullName ?? "-"} />
          <InfoItem definition label="Email" value={email} />
          <InfoItem definition label="Rol" value={roleLabel} />
          <InfoItem definition label="Área" value={plantName ?? "-"} />
          {department && <InfoItem definition label="Cargo" value={department} />}
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          Si tu nombre, área o cargo no son correctos, pedile a Gerencia que los corrija.
        </p>
      </section>

      <section className={cardClass({ padding: "lg" })}>
        <h2 className="text-sm font-semibold text-slate-900">Preferencias</h2>
        <p className="mt-1 text-xs text-slate-500">Tema. Se guarda en este dispositivo.</p>
        <div className="mt-4">
          <ThemeSelector />
        </div>
      </section>
    </div>
  );
}
