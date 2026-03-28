import Papa from "papaparse";
import { format } from "date-fns";
import type { Transaction, Person, Budget } from "@/types";

export function exportTransactionsToCSV(transactions: Transaction[], people: Person[], budgets: Budget[]) {
  const personMap = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const budgetMap = Object.fromEntries(budgets.map((b) => [b.id, b.name]));
  const rows = transactions.map((t) => ({
    Date: t.date,
    Type: t.type,
    Amount: t.amount,
    Category: t.category,
    Description: t.description,
    Person: personMap[t.personId] || t.personId,
    PaidBy: personMap[t.paidByPersonId || ""] || t.paidByPersonId || "",
    PaidByBreakdown: t.paidByBreakdown ? JSON.stringify(t.paidByBreakdown) : "",
    SplitType: t.splitType || "",
    Budget: budgetMap[t.budgetId] || t.budgetId,
  }));
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportedTransaction {
  date: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  paidBy?: string;
  paidByBreakdown?: string;
  splitType?: string;
}

export function importTransactionsFromCSV(file: File): Promise<ImportedTransaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const imported = rows.map((r) => ({
          date: r.Date || r.date || new Date().toISOString().split("T")[0],
          type: ((r.Type || r.type || "expense").toLowerCase() as "income" | "expense"),
          amount: parseFloat(r.Amount || r.amount || "0"),
          category: (r.Category || r.category || "other").toLowerCase(),
          description: r.Description || r.description || "",
          paidBy: r.PaidBy || r.paidBy || r.paid_by || "",
          paidByBreakdown: r.PaidByBreakdown || r.paidByBreakdown || r.paid_by_breakdown || "",
          splitType: (r.SplitType || r.splitType || r.split_type || "").toLowerCase(),
        }));
        resolve(imported);
      },
      error: reject,
    });
  });
}
