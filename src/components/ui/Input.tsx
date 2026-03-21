import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-xs font-display font-semibold text-white/50 uppercase tracking-wider">{label}</label>}
      <input
        id={id}
        className={cn(
          "bg-obsidian-800 border border-obsidian-600 text-white placeholder-white/20 rounded-lg px-3 py-2 text-sm font-body outline-none transition-all",
          "focus:border-volt/60 focus:ring-1 focus:ring-volt/20",
          error && "border-coral/60",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
