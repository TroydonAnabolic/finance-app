import { Card } from "./Card";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  type?: "income" | "expense" | "net" | "neutral";
  className?: string;
}

export function StatCard({ label, value, icon: Icon, type = "neutral", className }: StatCardProps) {
  const isPositive = value >= 0;
  return (
    <Card className={cn("p-5 flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-display font-semibold text-white/40 uppercase tracking-wider">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center",
          type === "income" && "bg-volt/10",
          type === "expense" && "bg-coral/10",
          type === "net" && (isPositive ? "bg-volt/10" : "bg-coral/10"),
          type === "neutral" && "bg-white/5",
        )}>
          <Icon size={16} className={cn(
            type === "income" && "text-volt",
            type === "expense" && "text-coral",
            type === "net" && (isPositive ? "text-volt" : "text-coral"),
            type === "neutral" && "text-white/50",
          )} />
        </div>
      </div>
      <p className={cn("font-display font-bold text-2xl",
        type === "income" && "text-volt",
        type === "expense" && "text-coral",
        type === "net" && (isPositive ? "text-volt" : "text-coral"),
        type === "neutral" && "text-white",
      )}>
        {type === "expense" ? "-" : ""}{formatCurrency(Math.abs(value))}
      </p>
    </Card>
  );
}
