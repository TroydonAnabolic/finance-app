"use client";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";
import type { Transaction, Category, TransactionType } from "@/types";
import toast from "react-hot-toast";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "housing", label: "Housing" }, { value: "food", label: "Food & Dining" },
  { value: "transport", label: "Transport" }, { value: "utilities", label: "Utilities" },
  { value: "entertainment", label: "Entertainment" }, { value: "health", label: "Health" },
  { value: "clothing", label: "Clothing" }, { value: "education", label: "Education" },
  { value: "savings", label: "Savings" }, { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" }, { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
];

interface Props { open: boolean; onClose: () => void; transaction: Transaction | null; }

export function EditTransactionModal({ open, onClose, transaction }: Props) {
  const { people, editTransaction } = useApp();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [personId, setPersonId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction) {
      setType(transaction.type); setAmount(String(transaction.amount));
      setCategory(transaction.category); setDescription(transaction.description);
      setDate(transaction.date); setPersonId(transaction.personId);
    }
  }, [transaction]);

  const handleSubmit = async () => {
    if (!transaction) return;
    setLoading(true);
    try {
      await editTransaction(transaction.id, { type, amount: parseFloat(amount), category, description, date, personId });
      toast.success("Transaction updated");
      onClose();
    } catch { toast.error("Failed to update"); }
    setLoading(false);
  };

  const budgetPeople = people.filter((p) => p.budgetId === transaction?.budgetId);

  return (
    <Modal open={open} onClose={onClose} title="Edit Transaction">
      <div className="flex flex-col gap-4">
        <div className="flex rounded-lg overflow-hidden border border-obsidian-600">
          {(["expense", "income"] as TransactionType[]).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 text-sm font-display font-semibold capitalize transition-all ${type === t
                ? t === "expense" ? "bg-coral text-white" : "bg-volt text-obsidian-950"
                : "text-white/40 hover:text-white/70"}`}>
              {t}
            </button>
          ))}
        </div>
        <Input label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as Category)} options={CATEGORIES} />
        <Select label="Person" value={personId} onChange={(e) => setPersonId(e.target.value)}
          options={[{ value: "", label: "Select person..." }, ...budgetPeople.map((p) => ({ value: p.id, label: p.name }))]} />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
