"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { StatCard } from "@/components/ui/StatCard";
import { MonthlyTrendsChart } from "@/components/charts/MonthlyTrendsChart";
import { CategoryBreakdownChart } from "@/components/charts/CategoryBreakdownChart";
import { PersonContributionsChart } from "@/components/charts/PersonContributionsChart";
import { AddTransactionModal } from "@/components/modals/AddTransactionModal";
import { Button } from "@/components/ui/Button";
import {
  getWeeklySummary, getFortnightlySummary, getMonthlySummary, getYearlySummary,
  getCategoryBreakdown, getMonthlyTrends, getPersonContributions, formatCurrency,
} from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Period = "weekly" | "fortnightly" | "monthly" | "yearly";
const PERIODS: Period[] = ["weekly", "fortnightly", "monthly", "yearly"];

export default function DashboardPage() {
  const { transactions, people, activeBudget, loading } = useApp();
  const [period, setPeriod] = useState<Period>("monthly");
  const [addOpen, setAddOpen] = useState(false);

  const parseDate = (value: string): Date | null => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const budgetTransactions = useMemo(() =>
    activeBudget ? transactions.filter((t) => t.budgetId === activeBudget.id) : [],
    [transactions, activeBudget]
  );
  const budgetPeople = useMemo(() =>
    people.filter((p) => p.budgetId === activeBudget?.id),
    [people, activeBudget]
  );

  const completedBudgetTransactions = useMemo(() => {
    const now = new Date();
    return budgetTransactions.filter((t) => {
      if (t.recurrenceStatus === "template" || !!t.isRecurring) return false;
      const dt = parseDate(t.date);
      if (!dt) return true;
      return dt.getTime() <= now.getTime();
    });
  }, [budgetTransactions]);

  const summary = useMemo(() => {
    if (period === "weekly") return getWeeklySummary(completedBudgetTransactions);
    if (period === "fortnightly") return getFortnightlySummary(completedBudgetTransactions);
    if (period === "monthly") return getMonthlySummary(completedBudgetTransactions);
    return getYearlySummary(completedBudgetTransactions);
  }, [completedBudgetTransactions, period]);

  const categoryData = useMemo(() => getCategoryBreakdown(completedBudgetTransactions), [completedBudgetTransactions]);
  const monthlyData = useMemo(() => getMonthlyTrends(completedBudgetTransactions), [completedBudgetTransactions]);
  const contributions = useMemo(
    () => getPersonContributions(completedBudgetTransactions, budgetPeople),
    [completedBudgetTransactions, budgetPeople],
  );

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-2xl text-white">
            {activeBudget?.name || "Overview"}
          </h1>
          <p className="text-white/40 font-body text-sm mt-0.5">
            {loading ? "Loading..." : `${completedBudgetTransactions.length} completed transactions · ${budgetPeople.length} people`}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus size={14} /> Add Transaction
        </Button>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 bg-obsidian-800 rounded-lg p-1 self-start border border-obsidian-600/50">
        {PERIODS.map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={cn("px-3 py-1.5 rounded-md text-xs font-display font-semibold capitalize transition-all",
              period === p ? "bg-obsidian-700 text-white shadow-sm" : "text-white/40 hover:text-white/70")}>
            {p}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div key={period} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Income" value={summary.income} icon={TrendingUp} type="income" />
        <StatCard label="Expenses" value={summary.expenses} icon={TrendingDown} type="expense" />
        <StatCard label="Net" value={summary.net} icon={Activity} type="net" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlyTrendsChart data={monthlyData} />
        {categoryData.length > 0
          ? <CategoryBreakdownChart data={categoryData} />
          : <div className="bg-obsidian-800/60 border border-obsidian-600/50 rounded-xl flex items-center justify-center text-white/20 text-sm font-body h-64">
              No expense data yet
            </div>
        }
      </div>

      {/* Person contributions */}
      {contributions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PersonContributionsChart data={contributions} />
          {/* Person breakdown list */}
          <div className="bg-obsidian-800/60 border border-obsidian-600/50 rounded-xl p-5">
            <h3 className="font-display font-bold text-white mb-4 text-sm uppercase tracking-wider">Contribution Breakdown</h3>
            <div className="flex flex-col gap-3">
              {contributions.map((c) => (
                <div key={c.person.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.person.color }} />
                      <span className="text-sm font-body text-white">{c.person.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-volt">{formatCurrency(c.income)}</span>
                      <span className="text-coral">-{formatCurrency(c.expenses)}</span>
                      <span className={c.net >= 0 ? "text-volt font-semibold" : "text-coral font-semibold"}>
                        {c.net >= 0 ? "+" : ""}{formatCurrency(c.net)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-obsidian-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${c.percentage}%`, backgroundColor: c.person.color }} />
                  </div>
                  <p className="text-xs font-body text-white/30">{c.percentage.toFixed(1)}% of total spend</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!activeBudget && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="font-display font-bold text-white text-lg">No budget selected</p>
            <p className="text-white/40 font-body text-sm mt-1">Create a budget from the sidebar to get started</p>
          </div>
        </div>
      )}

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
