"use client";
import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";
import type { Transaction, Category, SplitType, TransactionType } from "@/types";
import type { RecurrenceFrequency } from "@/types";
import { formatCurrency } from "@/lib/utils";
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
  const [paidByPersonId, setPaidByPersonId] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("personal");
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
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
  const budgetPeople = people.filter((p) => p.budgetId === transaction?.budgetId);
  const parsedAmount = Number.parseFloat(amount);
  const totalAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const totalPayerAmounts = useMemo(() => budgetPeople.reduce((sum, person) => {
    const value = Number.parseFloat(payerAmounts[person.id] || "0");
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0), [budgetPeople, payerAmounts]);

  const getPayerAmount = (payerId: string) => {
    const value = Number.parseFloat(payerAmounts[payerId] || "0");
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

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
      setPaidByPersonId(transaction.paidByPersonId || transaction.personId);
      setSplitType(transaction.splitType === "shared_equal" ? "shared_all_equal" : (transaction.splitType || "personal"));
      if (transaction.paidByBreakdown?.length) {
        const initialPayerAmounts: Record<string, string> = {};
        transaction.paidByBreakdown.forEach((entry) => {
          if (entry.personId) {
            initialPayerAmounts[entry.personId] = String(entry.amount);
          }
        });
        setPayerAmounts(initialPayerAmounts);
      } else {
        const fallbackPayerId = transaction.paidByPersonId || transaction.personId;
        setPayerAmounts(fallbackPayerId ? { [fallbackPayerId]: String(transaction.amount) } : {});
      }
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
      setPaidByPersonId("");
      setSplitType("personal");
      setPayerAmounts({});
    }
  }, [open, transaction, seriesTemplate]);

  const fillPaymentsEquallyAcrossAllMembers = () => {
    if (budgetPeople.length === 0) return;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter amount first");
      return;
    }

    const equalShare = Number((parsedAmount / budgetPeople.length).toFixed(2));
    const next: Record<string, string> = {};
    budgetPeople.forEach((person, index) => {
      if (index === budgetPeople.length - 1) {
        const subtotal = equalShare * (budgetPeople.length - 1);
        next[person.id] = String(Number((parsedAmount - subtotal).toFixed(2)));
      } else {
        next[person.id] = String(equalShare);
      }
    });
    setPayerAmounts(next);
  };

  const buildExpensePayerBreakdown = () => {
    if (splitType === "shared_all_equal") {
      return budgetPeople
        .map((person) => ({
          personId: person.id,
          amount: Number.parseFloat(payerAmounts[person.id] || "0"),
        }))
        .filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0)
        .map((entry) => ({ ...entry, amount: Number(entry.amount.toFixed(2)) }));
    }

    const payerId = paidByPersonId || personId;
    return payerId ? [{ personId: payerId, amount: Number(totalAmount.toFixed(2)) }] : [];
  };

  const rebalancePayerAmountsFromSlider = (targetPersonId: string, sliderPercent: number) => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter amount first");
      return;
    }

    const total = parsedAmount;
    const clampedPercent = Math.max(0, Math.min(100, sliderPercent));
    const targetAmount = Number((total * (clampedPercent / 100)).toFixed(2));
    const otherIds = budgetPeople.map((p) => p.id).filter((id) => id !== targetPersonId);
    const nextNumeric: Record<string, number> = { [targetPersonId]: targetAmount };
    const remaining = Number((total - targetAmount).toFixed(2));

    if (otherIds.length > 0) {
      const currentOtherTotal = otherIds.reduce((sum, id) => sum + getPayerAmount(id), 0);
      if (currentOtherTotal <= 0) {
        const equalShare = Number((remaining / otherIds.length).toFixed(2));
        otherIds.forEach((id, index) => {
          if (index === otherIds.length - 1) {
            const subtotal = equalShare * (otherIds.length - 1);
            nextNumeric[id] = Number((remaining - subtotal).toFixed(2));
          } else {
            nextNumeric[id] = equalShare;
          }
        });
      } else {
        let allocated = 0;
        otherIds.forEach((id, index) => {
          if (index === otherIds.length - 1) {
            nextNumeric[id] = Number((remaining - allocated).toFixed(2));
          } else {
            const proportional = Number((remaining * (getPayerAmount(id) / currentOtherTotal)).toFixed(2));
            nextNumeric[id] = proportional;
            allocated += proportional;
          }
        });
      }
    }

    const nextStrings: Record<string, string> = {};
    budgetPeople.forEach((person) => {
      nextStrings[person.id] = String(Number((nextNumeric[person.id] || 0).toFixed(2)));
    });
    setPayerAmounts(nextStrings);
  };

  const rebalancePayerAmountsForNewTotal = (nextTotal: number) => {
    if (!Number.isFinite(nextTotal) || nextTotal <= 0) return;

    const currentPositive = budgetPeople
      .map((person) => ({ personId: person.id, amount: getPayerAmount(person.id) }))
      .filter((entry) => entry.amount > 0);

    if (currentPositive.length === 0) return;

    const currentTotal = currentPositive.reduce((sum, entry) => sum + entry.amount, 0);
    if (currentTotal <= 0) return;

    const nextStrings: Record<string, string> = {};
    let allocated = 0;
    currentPositive.forEach((entry, index) => {
      if (index === currentPositive.length - 1) {
        nextStrings[entry.personId] = String(Number((nextTotal - allocated).toFixed(2)));
      } else {
        const scaled = Number((nextTotal * (entry.amount / currentTotal)).toFixed(2));
        nextStrings[entry.personId] = String(scaled);
        allocated += scaled;
      }
    });

    budgetPeople.forEach((person) => {
      if (!(person.id in nextStrings)) nextStrings[person.id] = "0";
    });

    setPayerAmounts(nextStrings);
  };

  const handleSubmit = async () => {
    if (!transaction) return;
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const payerBreakdown = type === "expense" ? buildExpensePayerBreakdown() : [];
    if (type === "expense" && payerBreakdown.length === 0) {
      toast.error("Enter at least one payer amount");
      return;
    }
    if (type === "expense" && splitType === "shared_all_equal") {
      const totalPaid = payerBreakdown.reduce((sum, entry) => sum + entry.amount, 0);
      if (Math.abs(totalPaid - totalAmount) > 0.01) {
        toast.error(`Payer amounts must equal ${formatCurrency(totalAmount)}`);
        return;
      }
    }

    const parsedInterval = parseInt(recurrenceInterval, 10);
    const isTemplateTransaction = transaction.recurrenceStatus === "template" || !!transaction.isRecurring;
    const isOccurrenceLikeTransaction = !isTemplateTransaction && (
      transaction.recurrenceStatus === "occurrence" ||
      !!transaction.recurrenceSourceId ||
      !!transaction.recurrenceGroupId
    );
    const isSingleOccurrenceEdit =
      editScope === "this" &&
      isOccurrenceLikeTransaction;

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
        paidByPersonId: type === "expense"
          ? (payerBreakdown[0]?.personId || paidByPersonId || personId)
          : personId,
        paidByBreakdown: type === "expense" ? payerBreakdown : null,
        splitType: type === "expense" ? splitType : "personal",
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

  return (
    <Modal open={open} onClose={onClose} title="Edit Transaction">
      <div className="flex flex-col gap-4">
        <div className="flex rounded-lg overflow-hidden border border-obsidian-600">
          {(["expense", "income"] as TransactionType[]).map((t) => (
            <button key={t} onClick={() => {
              setType(t);
              if (t === "income") {
                setSplitType("personal");
                if (personId) setPaidByPersonId(personId);
                setPayerAmounts({});
              }
            }}
              className={`flex-1 py-2 text-sm font-display font-semibold capitalize transition-all ${type === t
                ? t === "expense" ? "bg-coral text-white" : "bg-volt text-obsidian-950"
                : "text-white/40 hover:text-white/70"}`}>
              {t}
            </button>
          ))}
        </div>
        <Input label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => {
          const value = e.target.value;
          const nextTotal = Number.parseFloat(value);
          setAmount(value);
          if (type === "expense" && splitType === "personal") {
            const payerId = paidByPersonId || personId;
            if (payerId) {
              setPayerAmounts({ [payerId]: value });
            }
            return;
          }

          if (type === "expense" && splitType === "shared_all_equal") {
            rebalancePayerAmountsForNewTotal(nextTotal);
            const payerIds = Object.keys(payerAmounts);
            if (payerIds.length === 1) {
              const onlyPayerId = payerIds[0];
              setPayerAmounts({ [onlyPayerId]: value });
            }
          }
        }} />
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as Category)} options={CATEGORIES} />
        <Select label="Person" value={personId} onChange={(e) => {
          const nextPersonId = e.target.value;
          setPersonId(nextPersonId);
          if (type === "income" && nextPersonId) {
            setPaidByPersonId(nextPersonId);
          }
        }}
          options={[{ value: "", label: "Select person..." }, ...budgetPeople.map((p) => ({ value: p.id, label: p.name }))]} />

        {type === "expense" && (
          <Select
            label="Split type"
            value={splitType}
            onChange={(e) => {
              const nextSplitType = e.target.value as SplitType;
              setSplitType(nextSplitType);
              if (nextSplitType === "personal") {
                const payerId = paidByPersonId || personId;
                if (payerId) {
                  setPayerAmounts({ [payerId]: String(totalAmount || "") });
                }
              }
            }}
            options={[
              { value: "shared_all_equal", label: "Shared among all members (equal share)" },
              { value: "personal", label: "Personal (100% this person)" },
            ]}
          />
        )}

        {type === "expense" && splitType === "personal" && (
          <Select
            label="Paid by person"
            value={paidByPersonId}
            onChange={(e) => {
              const payerId = e.target.value;
              setPaidByPersonId(payerId);
              if (payerId) {
                setPayerAmounts({ [payerId]: String(totalAmount || "") });
              }
            }}
            options={[{ value: "", label: "Select payer..." }, ...budgetPeople.map((p) => ({ value: p.id, label: p.name }))]}
          />
        )}

        {type === "expense" && splitType === "shared_all_equal" && (
          <div className="rounded-lg border border-obsidian-600 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-white/50 font-body">
                Cost share will be split equally across {budgetPeople.length} member(s).
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={fillPaymentsEquallyAcrossAllMembers}>
                Split payment equally
              </Button>
            </div>
            <p className="text-xs text-white/40 font-body">Enter who paid and how much each person paid.</p>
            <div className="grid grid-cols-1 gap-2">
              {budgetPeople.map((person) => (
                <div key={person.id} className="grid grid-cols-[1fr_140px_1fr] gap-2 items-center">
                  <span className="text-sm text-white/70 font-body">{person.name}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payerAmounts[person.id] || ""}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      const numericValue = Number.parseFloat(inputValue);
                      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                        toast.error("Enter amount first");
                        setPayerAmounts((prev) => ({ ...prev, [person.id]: inputValue }));
                        return;
                      }
                      // Clamp to total
                      const clamped = Math.max(0, Math.min(parsedAmount, numericValue));
                      // Rebalance others
                      const otherIds = budgetPeople.map((p) => p.id).filter((id) => id !== person.id);
                      const remaining = Number((parsedAmount - clamped).toFixed(2));
                      let nextNumeric: Record<string, number> = { [person.id]: clamped };
                      if (otherIds.length > 0) {
                        const currentOtherTotal = otherIds.reduce((sum, id) => sum + getPayerAmount(id), 0);
                        if (currentOtherTotal <= 0) {
                          const equalShare = Number((remaining / otherIds.length).toFixed(2));
                          otherIds.forEach((id, idx) => {
                            if (idx === otherIds.length - 1) {
                              const subtotal = equalShare * (otherIds.length - 1);
                              nextNumeric[id] = Number((remaining - subtotal).toFixed(2));
                            } else {
                              nextNumeric[id] = equalShare;
                            }
                          });
                        } else {
                          let allocated = 0;
                          otherIds.forEach((id, idx) => {
                            if (idx === otherIds.length - 1) {
                              nextNumeric[id] = Number((remaining - allocated).toFixed(2));
                            } else {
                              const proportional = Number((remaining * (getPayerAmount(id) / currentOtherTotal)).toFixed(2));
                              nextNumeric[id] = proportional;
                              allocated += proportional;
                            }
                          });
                        }
                      }
                      const nextStrings: Record<string, string> = {};
                      budgetPeople.forEach((p) => {
                        nextStrings[p.id] = String(Number((nextNumeric[p.id] || 0).toFixed(2)));
                      });
                      setPayerAmounts(nextStrings);
                    }}
                    placeholder="0.00"
                    className="bg-obsidian-800 border border-obsidian-600 text-white placeholder-white/20 rounded-lg px-3 py-2 text-sm font-body outline-none focus:border-volt/60"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={totalAmount > 0 ? Math.round((getPayerAmount(person.id) / totalAmount) * 100) : 0}
                      onChange={(e) => rebalancePayerAmountsFromSlider(person.id, Number(e.target.value))}
                      disabled={totalAmount <= 0}
                      className="w-full accent-volt"
                    />
                    <span className="text-xs text-white/50 font-mono w-10 text-right">
                      {totalAmount > 0 ? Math.round((getPayerAmount(person.id) / totalAmount) * 100) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs font-body text-white/40">
              Total payer amount: <span className="text-white/70">{formatCurrency(totalPayerAmounts)}</span>
              {Number.isFinite(parsedAmount) && parsedAmount > 0 && (
                <span className="ml-2">(target {formatCurrency(parsedAmount)})</span>
              )}
            </p>
          </div>
        )}
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
