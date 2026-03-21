import { cn } from "@/lib/utils";

interface BadgeProps { label: string; color?: string; className?: string; }

export function Badge({ label, color = "#c8ff00", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-display font-semibold", className)}
      style={{ backgroundColor: color + "22", color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
