import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-obsidian-800/60 border border-obsidian-600/50 rounded-xl backdrop-blur-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}
