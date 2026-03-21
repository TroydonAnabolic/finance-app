import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, id, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-xs font-display font-semibold text-white/50 uppercase tracking-wider">{label}</label>}
      <select
        id={id}
        className={cn(
          "bg-obsidian-800 border border-obsidian-600 text-white rounded-lg px-3 py-2 text-sm font-body outline-none transition-all cursor-pointer",
          "focus:border-volt/60 focus:ring-1 focus:ring-volt/20",
          className
        )}
        {...props}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
