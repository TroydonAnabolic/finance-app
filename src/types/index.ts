export type TransactionType = "income" | "expense";

export type Category =
  | "housing" | "food" | "transport" | "utilities" | "entertainment"
  | "health" | "clothing" | "education" | "savings" | "salary"
  | "freelance" | "investment" | "other";

export interface Transaction {
  id: string;
  userId: string;
  budgetId: string;
  personId: string;
  type: TransactionType;
  amount: number;
  category: Category;
  description: string;
  date: string; // ISO date string YYYY-MM-DD
  createdAt: string;
}

export interface Person {
  id: string;
  userId: string;
  budgetId: string | null;
  name: string;
  email?: string;
  color: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  createdAt: string;
}

export interface PeriodSummary {
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryData {
  category: Category;
  amount: number;
  percentage: number;
  color: string;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface PersonContribution {
  person: Person;
  income: number;
  expenses: number;
  net: number;
  percentage: number;
}
