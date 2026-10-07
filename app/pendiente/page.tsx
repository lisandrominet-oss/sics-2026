import SignOutButton from "@/components/SignOutButton";
import BrandLogoFull from "@/components/BrandLogoFull";

export default function PendientePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <BrandLogoFull className="h-14 w-auto" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">Cuenta pendiente de habilitación</h1>
        <p className="mt-3 text-sm text-slate-500">
          Tu cuenta ya fue creada pero todavía no tiene un rol asignado.
          Pedile al administrador del sistema que te habilite.
        </p>
        <div className="mt-6 flex justify-center">
          <SignOutButton variant="light" />
        </div>
      </div>
    </div>
  );
}
