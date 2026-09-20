import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes } from "react";

const variants = cva("button", {
  variants: { variant: { default: "button-primary", outline: "button-outline", danger: "button-outline button-danger" }, size: { default: "", sm: "button-sm" } },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({ className, variant, size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>) {
  return <button className={twMerge(clsx(variants({ variant, size }), className))} {...props} />;
}
