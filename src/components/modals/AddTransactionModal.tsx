"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";
import { format } from "date-fns";
import type { Category, TransactionType } from "@/types";
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

interface Props { open: boolean; onClose: () => void; }

export function AddTransactionModal({ open, onClose }: Props) {
  const { activeBudget, people, addTransaction } = useApp();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [personId, setPersonId] = useState("");
  const [loading, setLoading] = useState(false);

  const budgetPeople = people.filter((p) => p.budgetId === activeBudget?.id);

  const handleSubmit = async () => {
    if (!activeBudget) return toast.error("Select a budget first");
    if (!amount || isNaN(parseFloat(amount))) return toast.error("Enter a valid amount");
    if (!personId) return toast.error("Select a person");
    setLoading(true);
    try {
      await addTransaction({
        budgetId: activeBudget.id,
        personId,
        type,
        amount: parseFloat(amount),
        category,
        description,
        date,
      });
      toast.success("Transaction added");
      setAmount(""); setDescription(""); setPersonId("");
      onClose();
    } catch {
      toast.error("Failed to add transaction");
    }
    setLoading(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction">
      <div className="flex flex-col gap-4">
        {/* Type toggle */}
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

        <Input label="Amount (NZD)" type="number" min="0" step="0.01" placeholder="0.00"
          value={amount} onChange={(e) => setAmount(e.target.value)} />

        <Select label="Category" value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          options={CATEGORIES.filter((c) =>
            type === "income" ? ["salary", "freelance", "investment", "other"].includes(c.value)
              : !["salary", "freelance", "investment"].includes(c.value)
          )} />

        <Select label="Person" value={personId} onChange={(e) => setPersonId(e.target.value)}
          options={[{ value: "", label: "Select person..." }, ...budgetPeople.map((p) => ({ value: p.id, label: p.name }))]} />

        <Input label="Description" placeholder="What was this for?" value={description}
          onChange={(e) => setDescription(e.target.value)} />

        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? "Adding..." : "Add Transaction"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
