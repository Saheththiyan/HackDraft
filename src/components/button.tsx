import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes } from "react";

const variants = cva("inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed", {
  variants: { variant: { default: "bg-emerald-400 text-slate-950 hover:bg-emerald-300", outline: "border border-slate-700 text-slate-200 hover:bg-slate-800" } },
  defaultVariants: { variant: "default" },
});
export function Button({ className, variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>) {
  return <button className={twMerge(clsx(variants({ variant }), className))} {...props} />;
}
