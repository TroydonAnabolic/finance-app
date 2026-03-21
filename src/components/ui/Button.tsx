import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-display font-semibold rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
        variant === "primary" && "bg-volt text-obsidian-950 hover:bg-volt-dim active:scale-95",
        variant === "secondary" && "bg-obsidian-700 text-white hover:bg-obsidian-600 border border-obsidian-600",
        variant === "ghost" && "text-white/60 hover:text-white hover:bg-obsidian-700",
        variant === "danger" && "bg-coral/10 text-coral hover:bg-coral/20 border border-coral/20",
        size === "sm" && "text-xs px-3 py-1.5",
        size === "md" && "text-sm px-4 py-2",
        size === "lg" && "text-base px-6 py-3",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
