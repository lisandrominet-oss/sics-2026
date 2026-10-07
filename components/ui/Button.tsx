import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import Spinner from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger" | "warning" | "ghost" | "link" | "link-danger";
export type ButtonSize = "sm" | "md" | "lg";

// Sin sombra: la estética (sombras, bordes) se decide en un solo lugar más adelante. La presión al tocar está en globals.css.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-500",
  warning: "bg-amber-600 text-white hover:bg-amber-500",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  link: "text-indigo-600 hover:underline",
  "link-danger": "text-red-600 hover:underline",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "rounded-md px-3 py-1 text-xs",
  md: "rounded-lg px-4 py-2 text-sm",
  lg: "rounded-lg px-5 py-2.5 text-sm",
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
    "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-base",
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
