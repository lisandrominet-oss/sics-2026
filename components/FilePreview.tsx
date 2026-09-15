"use client";

import { useState } from "react";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

export default function FilePreview({
  url,
  fileName,
  label,
}: {
  url: string | null;
  fileName: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!url) return <span className="text-slate-400">{label ?? fileName}</span>;

  if (!IMAGE_EXT.test(fileName)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-slate-900 underline">
        {label ?? fileName}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-left text-slate-900 hover:underline"
      >
        <img
          src={url}
          alt={fileName}
          className="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover"
        />
        <span className="underline">{label ?? fileName}</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <img
            src={url}
            alt={fileName}
            className="max-h-full max-w-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
