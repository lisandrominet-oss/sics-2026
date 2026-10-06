import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import Spinner from "./Spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 hover:shadow-md",
  secondary:
    "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-500 hover:shadow-md",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

const SIZES: Record<Size, string> = {
  sm: "rounded-md px-3 py-1.5 text-xs",
  md: "rounded-lg px-4 py-2 text-sm",
  lg: "rounded-lg px-5 py-2.5 text-sm",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
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
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-base ease-out-expo",
        "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
});

export default Button;
