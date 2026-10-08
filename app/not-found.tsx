import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { IconArrowLeft } from "@/components/icons";
import { eyebrowClass } from "@/lib/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className={eyebrowClass}>Error 404</p>
        <h1 className="mt-2 text-balance text-xl font-semibold tracking-tight text-slate-900">No encontramos esta página</h1>
        <p className="mt-2 text-pretty text-sm text-slate-500">
          El enlace puede estar mal escrito, o el registro ya no existe o no tenés acceso a verlo.
        </p>
        <Link href="/dashboard" className={buttonClass({ className: "mt-6" })}>
          <IconArrowLeft />
          Volver al tablero
        </Link>
      </div>
    </div>
  );
}
