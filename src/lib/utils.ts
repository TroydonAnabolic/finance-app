import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, subYears, isWithinInterval, parseISO } from "date-fns";
import type { Transaction, PeriodSummary, CategoryData, MonthlyData, PersonContribution, Person } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", minimumFractionDigits: 2 }).format(amount);
}

export function formatDate(date: string): string {
  return format(parseISO(date), "dd MMM yyyy");
}

export function formatDateTime(date: string): string {
  try {
    const d = parseISO(date);
    if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) {
      // Looks like a date-only value
      return format(d, "dd MMM yyyy");
    }
    return format(d, "dd MMM yyyy HH:mm");
  } catch {
    return date;
  }
}

export function getPeriodSummary(transactions: Transaction[], start: Date, end: Date): PeriodSummary {
  const inPeriod = transactions.filter((t) => {
    const d = parseISO(t.date);
    return isWithinInterval(d, { start, end });
  });
  const income = inPeriod.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = inPeriod.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expenses, net: income - expenses };
}

export function getWeeklySummary(transactions: Transaction[]): PeriodSummary {
  const now = new Date();
  return getPeriodSummary(transactions, startOfDay(subDays(now, 6)), endOfDay(now));
}

export function getFortnightlySummary(transactions: Transaction[]): PeriodSummary {
  const now = new Date();
  return getPeriodSummary(transactions, startOfDay(subDays(now, 13)), endOfDay(now));
}

export function getMonthlySummary(transactions: Transaction[]): PeriodSummary {
  const now = new Date();
  return getPeriodSummary(transactions, startOfDay(subDays(now, 29)), endOfDay(now));
}

export function getYearlySummary(transactions: Transaction[]): PeriodSummary {
  const now = new Date();
  return getPeriodSummary(transactions, startOfDay(subYears(now, 1)), endOfDay(now));
}

export const CATEGORY_COLORS: Record<string, string> = {
  housing: "#c8ff00", food: "#00d4ff", transport: "#ff6b6b", utilities: "#ffa500",
  entertainment: "#a78bfa", health: "#34d399", clothing: "#f472b6",
  education: "#60a5fa", savings: "#facc15", salary: "#4ade80",
  freelance: "#22d3ee", investment: "#fb923c", other: "#94a3b8",
};

export function getCategoryBreakdown(transactions: Transaction[]): CategoryData[] {
  const expenses = transactions.filter((t) => t.type === "expense");
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const grouped: Record<string, number> = {};
  expenses.forEach((t) => { grouped[t.category] = (grouped[t.category] || 0) + t.amount; });
  return Object.entries(grouped).map(([cat, amount]) => ({
    category: cat as CategoryData["category"],
    amount,
    percentage: total > 0 ? (amount / total) * 100 : 0,
    color: CATEGORY_COLORS[cat] || "#94a3b8",
  })).sort((a, b) => b.amount - a.amount);
}

export function getMonthlyTrends(transactions: Transaction[], months = 6): MonthlyData[] {
  const result: MonthlyData[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const summary = getPeriodSummary(transactions, start, end);
    result.push({ month: format(d, "MMM yy"), ...summary });
  }
  return result;
}

export function getPersonContributions(transactions: Transaction[], people: Person[]): PersonContribution[] {
  const total = transactions.reduce((s, t) => s + (t.type === "expense" ? t.amount : 0), 0);
  return people.map((person) => {
    const pt = transactions.filter((t) => t.personId === person.id);
    const income = pt.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = pt.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { person, income, expenses, net: income - expenses, percentage: total > 0 ? (expenses / total) * 100 : 0 };
  }).sort((a, b) => b.expenses - a.expenses);
}

export const PERSON_COLORS = [
  "#c8ff00", "#00d4ff", "#ff6b6b", "#a78bfa", "#34d399",
  "#ffa500", "#f472b6", "#60a5fa", "#facc15", "#22d3ee",
];
