import type { Budget, Person, Transaction } from "@/types";
import { getAdminDb } from "./firebaseAdmin";

function parseDate(value: string): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map((part) => Number(part));
    const parsedLocal = new Date(year, month - 1, day);
    return Number.isNaN(parsedLocal.getTime()) ? null : parsedLocal;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortTransactionsByDateDesc(items: Transaction[]): Transaction[] {
  return [...items].sort((a, b) => {
    const aTime = parseDate(a.date)?.getTime() ?? Number.MIN_SAFE_INTEGER;
    const bTime = parseDate(b.date)?.getTime() ?? Number.MIN_SAFE_INTEGER;
    return bTime - aTime;
  });
}

export async function assertBudgetOwnedByUser(userId: string, budgetId: string): Promise<Budget> {
  const budgetSnap = await getAdminDb().collection("budgets").doc(budgetId).get();
  if (!budgetSnap.exists) {
    throw new Error("Budget not found");
  }

  const budget = { id: budgetSnap.id, ...(budgetSnap.data() as Omit<Budget, "id">) } as Budget;
  if (budget.userId !== userId) {
    throw new Error("Forbidden");
  }

  return budget;
}

export async function getBudgetScopedData(userId: string, budgetId: string): Promise<{
  budget: Budget;
  transactions: Transaction[];
  people: Person[];
}> {
  const budget = await assertBudgetOwnedByUser(userId, budgetId);

  const [transactionsSnap, peopleSnap] = await Promise.all([
    getAdminDb().collection("transactions").where("userId", "==", userId).get(),
    getAdminDb().collection("people").where("userId", "==", userId).get(),
  ]);

  const transactions = sortTransactionsByDateDesc(
    transactionsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Transaction, "id">) } as Transaction))
      .filter((tx) => tx.budgetId === budgetId),
  );

  const people = peopleSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Person, "id">) } as Person))
    .filter((person) => person.budgetId === budgetId);

  return { budget, transactions, people };
}
