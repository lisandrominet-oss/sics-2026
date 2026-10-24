import type { Metadata } from "next";
import "./presentacion.css";
import ForzarClaro from "./_components/ForzarClaro";

export const metadata: Metadata = {
  title: "SICS 2026 · Presentación",
  description: "Qué es SICS, cómo funciona el circuito de compras y cómo se gobierna.",
  robots: { index: false, follow: false },
};

// Marca la página como presentación antes del primer dibujo (claro forzado y escala de las hojas), para que no haya parpadeo.
const INIT = `(function(){var r=document.documentElement;r.classList.remove('dark');r.style.colorScheme='light';r.classList.add('presentacion');})();`;

export default function PresentacionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: INIT }} />
      <ForzarClaro />
      {children}
    </>
  );
}
