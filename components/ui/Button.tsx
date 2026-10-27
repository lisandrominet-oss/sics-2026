import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import Spinner from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger" | "danger-outline" | "warning" | "ghost" | "link" | "link-danger";
export type ButtonSize = "sm" | "md" | "lg";

// Sin sombra: la estética (sombras, bordes) se decide en un solo lugar más adelante. La presión al tocar (clase `press`) está en globals.css.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-on-ink hover:bg-slate-800",
  secondary: "border border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300",
  // Rojo y ámbar suaves: el color dice "ojo" sin gritar; la acción principal sigue siendo la de tinta.
  danger: "bg-red-100 text-red-800 hover:bg-red-200",
  "danger-outline": "border border-red-200 bg-sheet text-red-700 hover:bg-red-50",
  warning: "bg-amber-100 text-amber-900 hover:bg-amber-200",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  link: "text-slate-900 underline underline-offset-2 hover:no-underline",
  "link-danger": "text-red-600 hover:underline",
};

const SIZES: Record<ButtonSize, string> = {
  // 44 px de alto en celular (dedo), 28/32/40 desde sm. `min-h` y no `h`: un texto largo puede envolver sin desbordar.
  sm: "min-h-9 rounded-lg px-3 py-1 text-[13px] sm:min-h-7",
  md: "min-h-11 rounded-lg px-4 py-1.5 text-sm sm:min-h-8",
  lg: "min-h-11 rounded-lg px-5 py-2 text-sm sm:min-h-10",
};

// Los botones de texto (link) no llevan relleno: solo el tamaño de letra.
const LINK_SIZES: Record<ButtonSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
};

/** Clases de un botón del sistema, para estilar un <Link> o <a> como botón. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  const isLink = variant === "link" || variant === "link-danger";
  return cn(
    "press inline-flex items-center justify-center gap-2 font-medium transition-colors duration-fast ease-out-expo",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    isLink ? LINK_SIZES[size] : SIZES[size],
    className
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra un spinner y bloquea el botón mientras la acción está en curso. */
  loading?: boolean;
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
      {...rest}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
});

export default Button;
