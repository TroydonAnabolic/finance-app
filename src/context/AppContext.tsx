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
  const removePerson = async (id: string) => { await deletePerson(id); await refresh(); };
  const removeTransaction = async (id: string) => { await deleteTransaction(id); await refresh(); };
  const editBudget = async (id: string, data: Partial<Budget>) => { await updateBudget(id, data); await refresh(); };
  const removeBudget = async (id: string) => { await deleteBudget(id); await refresh(); };

  return (
    <AppContext.Provider value={{
      budgets, people, transactions, activeBudget, setActiveBudget, loading, refresh,
      addBudget, addPerson, addTransaction, editPerson, editTransaction,
      removePerson, removeTransaction, editBudget, removeBudget,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
