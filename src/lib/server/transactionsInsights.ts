import type { Transaction } from "@/types";

type ForecastConfidence = "low" | "medium" | "high";

interface MoneyTotals {
  income: number;
  expenses: number;
  net: number;
}

export interface SupportingNumber {
  label: string;
  value: string | number;
}

export interface ForecastPrediction {
  horizonDays: number;
  runRate: MoneyTotals;
  knownScheduled: MoneyTotals & {
    transactionCount: number;
    syntheticOccurrences: number;
  };
  blended: MoneyTotals;
  confidence: ForecastConfidence;
  assumptions: string[];
  supportingNumbers: SupportingNumber[];
}

export interface CategorySpendItem {
  category: string;
  amount: number;
  sharePct: number;
  transactions: number;
}

export interface RecentTransactionItem {
  id: string;
  date: string;
  description: string;
  category: string;
  type: Transaction["type"];
  amount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseTxDate(value: string): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map((part) => Number(part));
    const parsedLocal = new Date(year, month - 1, day);
    return Number.isNaN(parsedLocal.getTime()) ? null : parsedLocal;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseEndDate(value?: string | null): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsedDateOnly = parseTxDate(value);
    return parsedDateOnly ? endOfLocalDay(parsedDateOnly) : null;
  }
  return parseTxDate(value);
}

function isDateOnly(value: string): boolean {
  return !value.includes("T");
}

function isTemplate(tx: Transaction): boolean {
  return tx.recurrenceStatus === "template" || !!tx.isRecurring;
}

function isOccurrenceLike(tx: Transaction): boolean {
  return tx.recurrenceStatus === "occurrence" || !!tx.recurrenceSourceId;
}

function isFutureTransaction(tx: Transaction, now: Date): boolean {
  const txDate = parseTxDate(tx.date);
  if (!txDate) return false;

  if (isDateOnly(tx.date)) {
    return txDate.getTime() > startOfLocalDay(now).getTime();
  }

  return txDate.getTime() > now.getTime();
}

function addToDate(date: Date, frequency: NonNullable<Transaction["recurrence"]>["frequency"], interval: number): Date {
  const next = new Date(date);
  switch (frequency) {
    case "minute":
      next.setMinutes(next.getMinutes() + interval);
      break;
    case "hour":
      next.setHours(next.getHours() + interval);
      break;
    case "daily":
      next.setDate(next.getDate() + interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + interval * 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + interval);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      break;
  }
  return next;
}

function toStoredDateValue(nextDate: Date, frequency: NonNullable<Transaction["recurrence"]>["frequency"]): string {
  if (frequency === "minute" || frequency === "hour") {
    return nextDate.toISOString();
  }
  return nextDate.toISOString().slice(0, 10);
}

function normalizeStoredDateValue(value: string, frequency: NonNullable<Transaction["recurrence"]>["frequency"]): string {
  const parsed = parseTxDate(value);
  if (!parsed) return value;
  return toStoredDateValue(parsed, frequency);
}

function computeTotals(items: Transaction[]): MoneyTotals {
  const income = items
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = items
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  return {
    income: roundMoney(income),
    expenses: roundMoney(expenses),
    net: roundMoney(income - expenses),
  };
}

function filterPostedTransactions(transactions: Transaction[], now: Date): Transaction[] {
  return transactions.filter((tx) => {
    if (isTemplate(tx)) return false;
    return !isFutureTransaction(tx, now);
  });
}

function betweenInclusive(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function trendMultiplier(currentValue: number, priorValue: number): number {
  if (priorValue <= 0 && currentValue <= 0) return 1;
  if (priorValue <= 0 && currentValue > 0) return 1.1;
  return clamp(currentValue / priorValue, 0.75, 1.25);
}

function confidenceFromSample(sampleTransactions: number, windowDays: number): ForecastConfidence {
  const density = sampleTransactions / Math.max(windowDays, 1);
  if (sampleTransactions >= 80 && density >= 0.45) return "high";
  if (sampleTransactions >= 25 && density >= 0.15) return "medium";
  return "low";
}

function buildTopExpenseCategories(history: Transaction[], limit = 3): string {
  const grouped = new Map<string, number>();
  let totalExpenses = 0;

  history
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      grouped.set(tx.category, (grouped.get(tx.category) || 0) + tx.amount);
      totalExpenses += tx.amount;
    });

  if (totalExpenses <= 0 || grouped.size === 0) return "No expense categories in historical window";

  return [...grouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, amount]) => {
      const share = ((amount / totalExpenses) * 100).toFixed(1);
      return `${category} (${share}%)`;
    })
    .join(", ");
}

function buildKnownScheduledTotals(transactions: Transaction[], now: Date, horizonDays: number) {
  const windowEnd = endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + horizonDays));

  const storedFuture = transactions.filter((tx) => {
    if (isTemplate(tx)) return false;
    if (!isFutureTransaction(tx, now)) return false;
    const txDate = parseTxDate(tx.date);
    if (!txDate) return false;
    return txDate.getTime() <= windowEnd.getTime();
  });

  const existingTemplateDateKeys = new Map<string, Set<string>>();
  storedFuture.forEach((tx) => {
    if (!tx.recurrenceSourceId) return;
    const set = existingTemplateDateKeys.get(tx.recurrenceSourceId) || new Set<string>();
    set.add(tx.date);
    existingTemplateDateKeys.set(tx.recurrenceSourceId, set);
  });

  let syntheticIncome = 0;
  let syntheticExpenses = 0;
  let syntheticOccurrences = 0;

  const templates = transactions.filter((tx) => isTemplate(tx) && !!tx.recurrence?.frequency);

  templates.forEach((template) => {
    const recurrence = template.recurrence;
    if (!recurrence?.frequency) return;

    const interval = recurrence.interval && recurrence.interval > 0 ? recurrence.interval : 1;
    const templateDate = parseTxDate(template.date);
    if (!templateDate) return;

    const endDate = parseEndDate(recurrence.endsOn);
    const existingSet = existingTemplateDateKeys.get(template.id) || new Set<string>();
    let cursor = new Date(templateDate);
    let guard = 0;

    while (guard < 1000) {
      cursor = addToDate(cursor, recurrence.frequency, interval);
      guard += 1;

      if (endDate && cursor.getTime() > endDate.getTime()) break;
      if (cursor.getTime() > windowEnd.getTime()) break;

      const dueDateValue = toStoredDateValue(cursor, recurrence.frequency);
      if (!isFutureTransaction({ ...template, date: dueDateValue }, now)) continue;

      if (existingSet.has(dueDateValue) || existingSet.has(normalizeStoredDateValue(dueDateValue, recurrence.frequency))) {
        continue;
      }

      if (template.type === "income") syntheticIncome += template.amount;
      else syntheticExpenses += template.amount;

      syntheticOccurrences += 1;
      existingSet.add(dueDateValue);
    }

    existingTemplateDateKeys.set(template.id, existingSet);
  });

  const storedTotals = computeTotals(storedFuture);
  const income = roundMoney(storedTotals.income + syntheticIncome);
  const expenses = roundMoney(storedTotals.expenses + syntheticExpenses);

  return {
    totals: {
      income,
      expenses,
      net: roundMoney(income - expenses),
      transactionCount: storedFuture.length + syntheticOccurrences,
      syntheticOccurrences,
    },
    windowEnd,
  };
}

export function buildForecastPrediction(transactions: Transaction[], horizonDays: number, now = new Date()): ForecastPrediction {
  const normalizedHorizon = clamp(Math.round(horizonDays), 1, 365);
  const postedTransactions = filterPostedTransactions(transactions, now);

  const historyWindowDays = clamp(Math.max(90, normalizedHorizon * 2), 90, 180);
  const historyStart = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (historyWindowDays - 1)));
  const historyEnd = endOfLocalDay(now);

  const historical = postedTransactions.filter((tx) => {
    const txDate = parseTxDate(tx.date);
    if (!txDate) return false;
    return betweenInclusive(txDate, historyStart, historyEnd);
  });

  const historicalTotals = computeTotals(historical);
  const avgDailyIncome = historicalTotals.income / historyWindowDays;
  const avgDailyExpenses = historicalTotals.expenses / historyWindowDays;

  const recent30Start = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  const prior30Start = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59));
  const prior30End = endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));

  const recent30 = postedTransactions.filter((tx) => {
    const txDate = parseTxDate(tx.date);
    if (!txDate) return false;
    return betweenInclusive(txDate, recent30Start, historyEnd);
  });

  const prior30 = postedTransactions.filter((tx) => {
    const txDate = parseTxDate(tx.date);
    if (!txDate) return false;
    return betweenInclusive(txDate, prior30Start, prior30End);
  });

  const recentTotals = computeTotals(recent30);
  const priorTotals = computeTotals(prior30);
  const incomeTrend = trendMultiplier(recentTotals.income, priorTotals.income);
  const expenseTrend = trendMultiplier(recentTotals.expenses, priorTotals.expenses);

  const runRateIncome = roundMoney(avgDailyIncome * normalizedHorizon * incomeTrend);
  const runRateExpenses = roundMoney(avgDailyExpenses * normalizedHorizon * expenseTrend);
  const runRate: MoneyTotals = {
    income: runRateIncome,
    expenses: runRateExpenses,
    net: roundMoney(runRateIncome - runRateExpenses),
  };

  const knownScheduled = buildKnownScheduledTotals(transactions, now, normalizedHorizon).totals;

  let scheduledWeight = normalizedHorizon <= 30 ? 0.55 : normalizedHorizon <= 60 ? 0.45 : 0.35;
  if (knownScheduled.transactionCount === 0) {
    scheduledWeight = 0;
  }

  const blendedIncome = roundMoney(runRate.income * (1 - scheduledWeight) + knownScheduled.income * scheduledWeight);
  const blendedExpenses = roundMoney(runRate.expenses * (1 - scheduledWeight) + knownScheduled.expenses * scheduledWeight);
  const blended: MoneyTotals = {
    income: blendedIncome,
    expenses: blendedExpenses,
    net: roundMoney(blendedIncome - blendedExpenses),
  };

  const confidence = confidenceFromSample(historical.length, historyWindowDays);
  const assumptions = [
    `Run-rate baseline uses the last ${historyWindowDays} days of posted transactions only (recurring templates excluded).`,
    "30-day trend adjustment is capped between 0.75x and 1.25x to reduce overreaction to outliers.",
    `Known scheduled future activity is blended at ${(scheduledWeight * 100).toFixed(0)}% for this ${normalizedHorizon}-day horizon.`,
    "Forecasts are directional estimates and do not account for unexpected one-off transactions.",
  ];

  const supportingNumbers: SupportingNumber[] = [
    { label: "History window", value: `${historyWindowDays} days` },
    { label: "Historical transactions used", value: historical.length },
    { label: "Average daily income", value: roundMoney(avgDailyIncome) },
    { label: "Average daily expenses", value: roundMoney(avgDailyExpenses) },
    { label: "Income trend (last 30d vs prior 30d)", value: `${(incomeTrend * 100).toFixed(1)}%` },
    { label: "Expense trend (last 30d vs prior 30d)", value: `${(expenseTrend * 100).toFixed(1)}%` },
    { label: "Known scheduled transactions", value: knownScheduled.transactionCount },
    { label: "Synthetic recurring occurrences", value: knownScheduled.syntheticOccurrences },
    { label: "Top expense categories", value: buildTopExpenseCategories(historical) },
  ];

  return {
    horizonDays: normalizedHorizon,
    runRate,
    knownScheduled,
    blended,
    confidence,
    assumptions,
    supportingNumbers,
  };
}

export function buildForecastSet(transactions: Transaction[], horizons: number[], now = new Date()): ForecastPrediction[] {
  return horizons.map((horizonDays) => buildForecastPrediction(transactions, horizonDays, now));
}

export function getCategorySpendBreakdown(transactions: Transaction[], lookbackDays: number, now = new Date()): CategorySpendItem[] {
  const normalizedLookbackDays = clamp(Math.round(lookbackDays), 7, 365);
  const windowStart = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (normalizedLookbackDays - 1)));
  const posted = filterPostedTransactions(transactions, now);
  const windowTx = posted.filter((tx) => {
    const txDate = parseTxDate(tx.date);
    if (!txDate) return false;
    return txDate.getTime() >= windowStart.getTime();
  });

  const categoryMap = new Map<string, { amount: number; count: number }>();
  let totalExpenses = 0;

  windowTx
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      totalExpenses += tx.amount;
      const existing = categoryMap.get(tx.category) || { amount: 0, count: 0 };
      existing.amount += tx.amount;
      existing.count += 1;
      categoryMap.set(tx.category, existing);
    });

  if (totalExpenses <= 0) return [];

  return [...categoryMap.entries()]
    .map(([category, metrics]) => ({
      category,
      amount: roundMoney(metrics.amount),
      sharePct: roundMoney((metrics.amount / totalExpenses) * 100),
      transactions: metrics.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function getRecentTransactions(transactions: Transaction[], limit: number): RecentTransactionItem[] {
  const normalizedLimit = clamp(Math.round(limit), 1, 25);
  return transactions
    .filter((tx) => !isTemplate(tx))
    .slice(0, normalizedLimit)
    .map((tx) => ({
      id: tx.id,
      date: tx.date,
      description: tx.description || "",
      category: tx.category,
      type: tx.type,
      amount: roundMoney(tx.amount),
    }));
}

export function getBudgetSnapshot(transactions: Transaction[], now = new Date()): {
  postedCount: number;
  upcomingCount: number;
  postedTotals: MoneyTotals;
  upcomingTotals: MoneyTotals;
  topExpenseCategories: CategorySpendItem[];
} {
  const posted = filterPostedTransactions(transactions, now);
  const upcoming = transactions.filter((tx) => !isTemplate(tx) && isFutureTransaction(tx, now));

  return {
    postedCount: posted.length,
    upcomingCount: upcoming.length,
    postedTotals: computeTotals(posted),
    upcomingTotals: computeTotals(upcoming),
    topExpenseCategories: getCategorySpendBreakdown(transactions, 90, now).slice(0, 5),
  };
}

export function pickHorizonPrediction(predictions: ForecastPrediction[], preferredHorizon: number): ForecastPrediction {
  const exact = predictions.find((prediction) => prediction.horizonDays === preferredHorizon);
  return exact || predictions[0];
}

export function summarizePrediction(prediction: ForecastPrediction): string {
  const sign = prediction.blended.net >= 0 ? "+" : "";
  return `Next ${prediction.horizonDays} days: income ${prediction.blended.income}, expenses ${prediction.blended.expenses}, net ${sign}${prediction.blended.net}.`;
}

export function isRecurringOccurrence(transaction: Transaction): boolean {
  return isOccurrenceLike(transaction);
}
