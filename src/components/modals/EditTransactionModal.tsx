"use client";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";
import type { Transaction, Category, TransactionType } from "@/types";
import type { RecurrenceFrequency } from "@/types";
const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: "minute", label: "Every Minute" },
  { value: "hour", label: "Every Hour" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];
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

type RecurringEditScope = "this" | "this_and_future" | "all";

const EDIT_SCOPE_OPTIONS: { value: RecurringEditScope; label: string }[] = [
  { value: "this", label: "Edit this transaction only" },
  { value: "this_and_future", label: "Edit this and future transactions" },
  { value: "all", label: "Edit all transactions in series" },
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateTimeLocalInput(value: string): string {
  if (!value) return "";
  if (!value.includes("T")) {
    return `${value}T00:00`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const yyyy = parsed.getFullYear();
  const mm = pad2(parsed.getMonth() + 1);
  const dd = pad2(parsed.getDate());
  const hh = pad2(parsed.getHours());
  const min = pad2(parsed.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromDateTimeLocalInput(value: string, preserveDateOnly: boolean): string {
  if (!value) return "";
  if (preserveDateOnly) {
    return value.slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString();
}

export function EditTransactionModal({ open, onClose, transaction }: Props) {
  const { people, transactions, editTransaction, editTransactionSeries } = useApp();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [preserveDateOnly, setPreserveDateOnly] = useState(false);
  const [personId, setPersonId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>("monthly");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [editScope, setEditScope] = useState<RecurringEditScope>("this");
  const [loading, setLoading] = useState(false);

  const canEditSeries = !!transaction?.recurrenceGroupId || transaction?.recurrenceStatus === "template" || transaction?.recurrenceStatus === "occurrence" || !!transaction?.recurrenceSourceId;

  const seriesTemplate = transaction?.recurrenceGroupId
    ? transactions.find(
        (t) =>
          t.recurrenceGroupId === transaction.recurrenceGroupId &&
          (t.recurrenceStatus === "template" || t.isRecurring || !!t.recurrence)
      )
    : null;

  const seriesRecurrence = transaction?.recurrence || seriesTemplate?.recurrence || null;

  const recurrenceRole = transaction?.recurrenceStatus === "template"
    ? "Template"
    : transaction?.recurrenceStatus === "occurrence"
      ? "Occurrence"
      : transaction?.recurrenceGroupId
        ? "Grouped"
        : "One-time";

  useEffect(() => {
    if (open && transaction) {
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setCategory(transaction.category);
      setDescription(transaction.description);
      setPreserveDateOnly(!transaction.date.includes("T"));
      setDate(toDateTimeLocalInput(transaction.date));
      setPersonId(transaction.personId);
      const recurring =
        !!transaction.isRecurring ||
        !!transaction.recurrence ||
        !!transaction.recurrenceGroupId ||
        transaction.recurrenceStatus === "template" ||
        transaction.recurrenceStatus === "occurrence" ||
        !!transaction.recurrenceSourceId;
      const recurrenceConfig = transaction.recurrence || seriesTemplate?.recurrence || null;
      setIsRecurring(recurring);
      setRecurrenceFrequency(recurring && recurrenceConfig?.frequency ? recurrenceConfig.frequency : "monthly");
      setRecurrenceInterval(recurring && recurrenceConfig?.interval ? String(recurrenceConfig.interval) : "1");
      setRecurrenceEndDate(recurring && recurrenceConfig?.endsOn ? recurrenceConfig.endsOn : "");
    } else if (!open) {
      setIsRecurring(false);
      setRecurrenceFrequency("monthly");
      setRecurrenceInterval("1");
      setRecurrenceEndDate("");
      setPreserveDateOnly(false);
      setEditScope("this");
    }
  }, [open, transaction, seriesTemplate]);

  const handleSubmit = async () => {
    if (!transaction) return;
    const parsedInterval = parseInt(recurrenceInterval, 10);
    const isSingleOccurrenceEdit =
      editScope === "this" &&
      (transaction.recurrenceStatus === "occurrence" || !!transaction.recurrenceSourceId);

    const recurrenceGroupId = isRecurring
      ? (transaction.recurrenceGroupId || (isSingleOccurrenceEdit ? null : crypto.randomUUID()))
      : null;
    if (isRecurring && (!parsedInterval || parsedInterval < 1)) {
      toast.error("Recurrence interval must be at least 1");
      return;
    }
    setLoading(true);
    try {
      const updatePayload: Partial<Transaction> = {
        type,
        amount: parseFloat(amount),
        category,
        description,
        date: fromDateTimeLocalInput(date, preserveDateOnly),
        personId,
        isRecurring: isSingleOccurrenceEdit ? false : isRecurring,
        recurrenceStatus: isRecurring
          ? (isSingleOccurrenceEdit ? "occurrence" : "template")
          : "one_time",
        recurrenceGroupId,
        recurrenceSourceId: isSingleOccurrenceEdit ? transaction.recurrenceSourceId || null : null,
        recurrence: isRecurring
          ? {
              frequency: recurrenceFrequency,
              interval: parsedInterval,
              endsOn: recurrenceEndDate || null,
            }
          : null,
      };

      if (canEditSeries && editScope !== "this") {
        await editTransactionSeries(transaction, editScope, updatePayload);
      } else {
        await editTransaction(transaction.id, updatePayload);
      }

      toast.success("Transaction updated");
      onClose();
    } catch {
      toast.error("Failed to update");
    }
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
        <Input label="Date & Time" type="datetime-local" step="60" value={date} onChange={(e) => setDate(e.target.value)} />
        {canEditSeries && (
          <Select
            label="Apply changes to"
            value={editScope}
            onChange={(e) => setEditScope(e.target.value as RecurringEditScope)}
            options={EDIT_SCOPE_OPTIONS}
          />
        )}
        <div className="rounded-lg border border-obsidian-600 p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-display font-semibold text-white">Recurring</p>
            <p className="text-xs text-white/40 font-body">Automatically repeats on a schedule</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isRecurring}
            onClick={() => setIsRecurring((prev) => !prev)}
            className={`relative h-6 w-11 rounded-full transition-colors ${isRecurring ? "bg-volt" : "bg-obsidian-600"}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${isRecurring ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>

        {transaction?.recurrenceGroupId && (
          <div className="rounded-lg border border-obsidian-600 p-3 text-xs font-body text-white/70 space-y-1">
            <p><span className="text-white/40">Series Group:</span> {transaction.recurrenceGroupId}</p>
            <p><span className="text-white/40">Role:</span> {recurrenceRole}</p>
            <p>
              <span className="text-white/40">Series Schedule:</span>{" "}
              {seriesRecurrence?.frequency
                ? `${seriesRecurrence.frequency} every ${seriesRecurrence.interval || 1}`
                : "No schedule metadata found"}
            </p>
          </div>
        )}

        {isRecurring && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-obsidian-600 p-3">
            <Select
              label="Frequency"
              value={recurrenceFrequency}
              onChange={(e) => setRecurrenceFrequency(e.target.value as RecurrenceFrequency)}
              options={RECURRENCE_OPTIONS}
            />
            <Input
              label="Every"
              type="number"
              min="1"
              step="1"
              placeholder="1"
              value={recurrenceInterval}
              onChange={(e) => setRecurrenceInterval(e.target.value)}
            />
            <div className="md:col-span-2">
              <Input
                label="Ends on (optional)"
                type="date"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
              />
            </div>
          </div>
        )}

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
