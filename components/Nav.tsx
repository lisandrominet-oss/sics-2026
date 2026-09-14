import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import RoleSwitcher from "@/components/RoleSwitcher";
import { CAN_CREATE_SIC, ROLE_LABELS, type UserRole } from "@/lib/constants";

export default function Nav({
  role,
  realRole,
  userId,
  actingAsRole,
  fullName,
}: {
  role: UserRole;
  realRole: UserRole;
  userId: string;
  actingAsRole: UserRole | null;
  fullName: string | null;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold text-slate-900">
            Sistema de Compras
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-900">
              Tablero
            </Link>
            {CAN_CREATE_SIC.includes(role) && (
              <Link href="/sic/nueva" className="hover:text-slate-900">
                Nueva SIC
              </Link>
            )}
            {role === "admin" && (
              <>
                <Link href="/admin/usuarios" className="hover:text-slate-900">
                  Usuarios
                </Link>
                <Link href="/admin/plantas" className="hover:text-slate-900">
                  Plantas
                </Link>
                <Link href="/admin/proyectos" className="hover:text-slate-900">
                  Proyectos
                </Link>
                <Link href="/admin/config" className="hover:text-slate-900">
                  Configuración
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {realRole === "admin" && <RoleSwitcher userId={userId} actingAsRole={actingAsRole} />}
          <span className="text-slate-500">
            {fullName ?? "Usuario"} · {ROLE_LABELS[role]}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
