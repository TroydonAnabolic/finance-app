"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  getUserBudgets, getUserPeople, getUserTransactions,
  createBudget, createPerson, createTransaction,
  updatePerson, updateTransaction, deletePerson, deleteTransaction,
  updateBudget, deleteBudget,
} from "@/lib/firestore";
import type { Budget, Person, Transaction } from "@/types";

type RecurringEditScope = "this" | "this_and_future" | "all";

interface AppContextType {
  budgets: Budget[];
  people: Person[];
  transactions: Transaction[];
  activeBudget: Budget | null;
  setActiveBudget: (b: Budget | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
  addBudget: (name: string, description?: string) => Promise<string>;
  addPerson: (data: Omit<Person, "id" | "userId" | "createdAt">) => Promise<string>;
  addTransaction: (data: Omit<Transaction, "id" | "userId" | "createdAt">) => Promise<string>;
  editPerson: (id: string, data: Partial<Person>) => Promise<void>;
  editTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  editTransactionSeries: (target: Transaction, scope: RecurringEditScope, data: Partial<Transaction>) => Promise<void>;
  removePerson: (id: string) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  editBudget: (id: string, data: Partial<Budget>) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [b, p, t] = await Promise.all([getUserBudgets(user.uid), getUserPeople(user.uid), getUserTransactions(user.uid)]);
    setBudgets(b);
    setPeople(p);
    setTransactions(t);
    setActiveBudget((prev) => b.find((x) => x.id === prev?.id) || b[0] || null);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const addBudget = async (name: string, description?: string) => {
    const id = await createBudget(user!.uid, name, description);
    await refresh();
    return id;
  };

  const addPerson = async (data: Omit<Person, "id" | "userId" | "createdAt">) => {
    const id = await createPerson({ ...data, userId: user!.uid, createdAt: new Date().toISOString() });
    await refresh();
    return id;
  };

  const addTransaction = async (data: Omit<Transaction, "id" | "userId" | "createdAt">) => {
    const id = await createTransaction({ ...data, userId: user!.uid, createdAt: new Date().toISOString() });
    await refresh();
    return id;
  };

  const editPerson = async (id: string, data: Partial<Person>) => { await updatePerson(id, data); await refresh(); };
  const editTransaction = async (id: string, data: Partial<Transaction>) => { await updateTransaction(id, data); await refresh(); };
  const editTransactionSeries = async (target: Transaction, scope: RecurringEditScope, data: Partial<Transaction>) => {
    if (scope === "this" || !target.recurrenceGroupId) {
      await updateTransaction(target.id, data);
      await refresh();
      return;
    }

    const groupTransactions = transactions.filter((t) => t.recurrenceGroupId === target.recurrenceGroupId);
    const anchorTime = new Date(target.date).getTime();

    const targets = groupTransactions.filter((t) => {
      const isTemplate = t.recurrenceStatus === "template" || !!t.isRecurring;
      if (scope === "all") return true;
      if (isTemplate) return true;
      const txTime = new Date(t.date).getTime();
      if (Number.isNaN(anchorTime) || Number.isNaN(txTime)) return t.id === target.id;
      return txTime >= anchorTime;
    });

    const seriesData = { ...data };
    delete seriesData.date;

    await Promise.all(targets.map(async (tx) => {
      const isTemplate = tx.recurrenceStatus === "template" || !!tx.isRecurring;
      const updateData: Partial<Transaction> = { ...seriesData };

      if (isTemplate) {
        updateData.isRecurring = true;
        updateData.recurrenceStatus = "template";
        updateData.recurrenceSourceId = null;
        updateData.recurrenceGroupId = tx.recurrenceGroupId || target.recurrenceGroupId || target.id;
      } else {
        delete updateData.isRecurring;
        delete updateData.recurrence;
        delete updateData.recurrenceStatus;
        delete updateData.recurrenceSourceId;
      }

      await updateTransaction(tx.id, updateData);
    }));

    await refresh();
  };
  const removePerson = async (id: string) => { await deletePerson(id); await refresh(); };
  const removeTransaction = async (id: string) => { await deleteTransaction(id); await refresh(); };
  const editBudget = async (id: string, data: Partial<Budget>) => { await updateBudget(id, data); await refresh(); };
  const removeBudget = async (id: string) => { await deleteBudget(id); await refresh(); };

  return (
    <AppContext.Provider value={{
      budgets, people, transactions, activeBudget, setActiveBudget, loading, refresh,
      addBudget, addPerson, addTransaction, editPerson, editTransaction, editTransactionSeries,
      removePerson, removeTransaction, editBudget, removeBudget,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
