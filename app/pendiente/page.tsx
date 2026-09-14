import SignOutButton from "@/components/SignOutButton";

export default function PendientePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
          SC
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
