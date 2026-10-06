// Logo completo (isotipo + nombre) para fondos claros u oscuros según el tema.
export default function BrandLogoFull({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/brand/logo-completo-color.svg"
        alt="Servicios Industriales"
        className={`dark:hidden ${className ?? ""}`}
      />
      <img
        src="/brand/logo-completo-negativo.svg"
        alt=""
        aria-hidden="true"
        className={`hidden dark:block ${className ?? ""}`}
      />
    </>
  );
}
