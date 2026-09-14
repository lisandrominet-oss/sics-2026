import SignOutButton from "@/components/SignOutButton";

export default function PendientePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Cuenta pendiente de habilitación</h1>
        <p className="mt-3 text-sm text-slate-500">
          Tu cuenta ya fue creada pero todavía no tiene un rol asignado.
          Pedile al administrador del sistema que te habilite.
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
