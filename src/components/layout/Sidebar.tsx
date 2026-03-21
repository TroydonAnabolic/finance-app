"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CreditCard, Users, PieChart, LogOut, ChevronDown, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
  { href: "/people", label: "People", icon: Users },
  { href: "/budget", label: "Budget", icon: PieChart },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { budgets, activeBudget, setActiveBudget, addBudget } = useApp();
  const [budgetOpen, setBudgetOpen] = useState(false);

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 bg-obsidian-900 border-r border-obsidian-700 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-6 border-b border-obsidian-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-volt flex items-center justify-center">
            <span className="text-obsidian-950 font-display font-black text-xs">$</span>
          </div>
          <span className="font-display font-black text-white text-base">Ledger</span>
        </div>
      </div>

      {/* Budget Selector */}
      <div className="p-3 border-b border-obsidian-700">
        <button
          onClick={() => setBudgetOpen(!budgetOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 transition-colors text-sm"
        >
          <span className="font-body text-white/70 truncate">{activeBudget?.name || "No Budget"}</span>
          <ChevronDown size={14} className={cn("text-white/40 transition-transform", budgetOpen && "rotate-180")} />
        </button>
        {budgetOpen && (
          <div className="mt-1 bg-obsidian-800 border border-obsidian-600 rounded-lg overflow-hidden">
            {budgets.map((b) => (
              <button key={b.id} onClick={() => { setActiveBudget(b); setBudgetOpen(false); }}
                className={cn("w-full text-left px-3 py-2 text-sm font-body hover:bg-obsidian-700 transition-colors",
                  activeBudget?.id === b.id ? "text-volt" : "text-white/70")}>
                {b.name}
              </button>
            ))}
            <button onClick={async () => {
              const name = prompt("Budget name:");
              if (name) { await addBudget(name); setBudgetOpen(false); }
            }} className="w-full text-left px-3 py-2 text-sm font-body text-white/30 hover:text-white/60 hover:bg-obsidian-700 transition-colors flex items-center gap-2">
              <Plus size={12} /> New Budget
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-all",
                active ? "bg-volt/10 text-volt" : "text-white/50 hover:text-white hover:bg-obsidian-700")}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-obsidian-700">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-body text-white/40 truncate">{user?.email}</p>
          </div>
          <button onClick={signOut} className="p-1.5 rounded-lg text-white/30 hover:text-coral hover:bg-coral/10 transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
