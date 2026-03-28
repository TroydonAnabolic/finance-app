export type TransactionType = "income" | "expense";

export type SplitType = "personal" | "shared_equal" | "shared_all_equal";

export type RecurrenceFrequency = "minute" | "hour" | "daily" | "weekly" | "monthly" | "yearly";

export type Category =
  | "housing" | "food" | "transport" | "utilities" | "entertainment"
  | "health" | "clothing" | "education" | "savings" | "salary"
  | "freelance" | "investment" | "other";

export interface Transaction {
  id: string;
  userId: string;
  budgetId: string;
  personId: string;
  paidByPersonId?: string | null;
  paidByBreakdown?: { personId: string; amount: number }[] | null;
  splitType?: SplitType | null;
  type: TransactionType;
  amount: number;
  category: Category;
  description: string;
  date: string; // ISO date string YYYY-MM-DD
  isRecurring?: boolean;
  recurrence?: {
    frequency: RecurrenceFrequency;
    interval: number;
    endsOn?: string | null;
  } | null;
  recurrenceStatus?: "one_time" | "template" | "occurrence";
  recurrenceGroupId?: string | null;
  recurrenceSourceId?: string | null;
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
