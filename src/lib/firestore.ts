import {
  db, collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, Timestamp,
} from "./firebase";
import type { Transaction, Person, Budget, UserProfile } from "@/types";

// User Profile
export async function createUserProfile(uid: string, email: string) {
  await setDoc(doc(db, "users", uid), { uid, email, createdAt: new Date().toISOString() });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// Budgets
export async function createBudget(userId: string, name: string, description?: string): Promise<string> {
  const ref = await addDoc(collection(db, "budgets"), {
    userId, name, description: description || "", createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function getUserBudgets(userId: string): Promise<Budget[]> {
  const q = query(collection(db, "budgets"), where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Budget));
}

export async function updateBudget(id: string, data: Partial<Budget>) {
  await updateDoc(doc(db, "budgets", id), data);
}

export async function deleteBudget(id: string) {
  await deleteDoc(doc(db, "budgets", id));
}

// People
export async function createPerson(data: Omit<Person, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "people"), { ...data, createdAt: new Date().toISOString() });
  return ref.id;
}

export async function getUserPeople(userId: string): Promise<Person[]> {
  const q = query(collection(db, "people"), where("userId", "==", userId), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Person));
}

export async function updatePerson(id: string, data: Partial<Person>) {
  await updateDoc(doc(db, "people", id), data);
}

export async function deletePerson(id: string) {
  await deleteDoc(doc(db, "people", id));
}

// Transactions
export async function createTransaction(data: Omit<Transaction, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "transactions"), { ...data, createdAt: new Date().toISOString() });
  return ref.id;
}

export async function getUserTransactions(userId: string): Promise<Transaction[]> {
  const q = query(collection(db, "transactions"), where("userId", "==", userId), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
}

export async function getBudgetTransactions(budgetId: string): Promise<Transaction[]> {
  const q = query(collection(db, "transactions"), where("budgetId", "==", budgetId), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
}

export async function updateTransaction(id: string, data: Partial<Transaction>) {
  await updateDoc(doc(db, "transactions", id), data);
}

export async function deleteTransaction(id: string) {
  await deleteDoc(doc(db, "transactions", id));
}
