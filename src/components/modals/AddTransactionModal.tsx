"use client";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";
import { format } from "date-fns";
import type { Category, RecurrenceFrequency, SplitType, TransactionType } from "@/types";
import { formatCurrency } from "@/lib/utils";
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

const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: "minute", label: "Every Minute" },
  { value: "hour", label: "Every Hour" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
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
  const [paidByPersonId, setPaidByPersonId] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("shared_all_equal");
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>("monthly");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoSplitEqually, setAutoSplitEqually] = useState(true);

  const budgetPeople = people.filter((p) => p.budgetId === activeBudget?.id);
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

  const getPartnerId = (selectedPersonId: string) => {
    if (!selectedPersonId) return "";
    return budgetPeople.find((p) => p.id !== selectedPersonId)?.id || selectedPersonId;
  };

  const getDebtTrackerDefaults = () => {
    if (typeof window === "undefined" || !activeBudget) return null;
    try {
      const raw = window.localStorage.getItem(`ledger-debt-tracker:${activeBudget.id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { debtorId?: string; creditorId?: string };
      if (!parsed.debtorId || !parsed.creditorId) return null;
      const debtorExists = budgetPeople.some((p) => p.id === parsed.debtorId);
      const creditorExists = budgetPeople.some((p) => p.id === parsed.creditorId);
      if (!debtorExists || !creditorExists) return null;
      return { debtorId: parsed.debtorId, creditorId: parsed.creditorId };
    } catch {
      return null;
    }
  };

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

  // Auto split equally effect
  useMemo(() => {
    if (autoSplitEqually && type === "expense" && splitType === "shared_all_equal") {
      if (budgetPeople.length === 0) return;
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSplitEqually, parsedAmount, budgetPeople.length, type, splitType]);

  const applySharedGroupPreset = () => {
    if (budgetPeople.length < 2) {
      toast.error("Add at least two people in this budget to use shared group preset");
      return;
    }

    setType("expense");
    setSplitType("shared_all_equal");

    const debtDefaults = getDebtTrackerDefaults();
    const debtorId = debtDefaults?.debtorId || personId || budgetPeople[0].id;
    const creditorId = debtDefaults?.creditorId || getPartnerId(debtorId);

    setPersonId(debtorId);
    setPaidByPersonId(creditorId);

    if (totalAmount > 0 && creditorId) {
      setPayerAmounts({ [creditorId]: String(totalAmount) });
    }
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
    if (!activeBudget) return toast.error("Select a budget first");
    if (!amount || isNaN(parseFloat(amount))) return toast.error("Enter a valid amount");
    if (!personId) return toast.error("Select a person");
    if (type === "expense" && splitType === "personal" && !paidByPersonId) {
      return toast.error("Select who paid");
    }

    const payerBreakdown = type === "expense" ? buildExpensePayerBreakdown() : [];
    if (type === "expense" && payerBreakdown.length === 0) {
      return toast.error("Enter at least one payer amount");
    }

    if (type === "expense" && splitType === "shared_all_equal") {
      const totalPaid = payerBreakdown.reduce((sum, entry) => sum + entry.amount, 0);
      if (Math.abs(totalPaid - totalAmount) > 0.01) {
        return toast.error(`Payer amounts must equal ${formatCurrency(totalAmount)}`);
      }
    }

    const parsedInterval = parseInt(recurrenceInterval, 10);
    const recurrenceGroupId = isRecurring ? crypto.randomUUID() : null;
    const normalizedSplitType: SplitType = type === "expense" ? splitType : "personal";
    if (isRecurring && (!parsedInterval || parsedInterval < 1)) {
      return toast.error("Recurrence interval must be at least 1");
    }
    setLoading(true);
    try {
      await addTransaction({
        budgetId: activeBudget.id,
        personId,
        paidByPersonId: type === "expense"
          ? (payerBreakdown[0]?.personId || paidByPersonId || personId)
          : personId,
        paidByBreakdown: type === "expense" ? payerBreakdown : null,
        splitType: normalizedSplitType,
        type,
        amount: parseFloat(amount),
        category,
        description,
        date,
        isRecurring,
        recurrenceStatus: isRecurring ? "template" : "one_time",
        recurrenceGroupId,
        recurrenceSourceId: null,
        recurrence: isRecurring
          ? {
            frequency: recurrenceFrequency,
            interval: parsedInterval,
            endsOn: recurrenceEndDate || null,
          }
          : null,
      });
      toast.success("Transaction added");
      setAmount(""); setDescription(""); setPersonId(""); setPaidByPersonId("");
      setSplitType("shared_all_equal");
      setPayerAmounts({});
      setIsRecurring(false);
      setRecurrenceFrequency("monthly");
      setRecurrenceInterval("1");
      setRecurrenceEndDate("");
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
            <button key={t} onClick={() => {
              setType(t);
              if (t === "income") {
                setSplitType("personal");
                if (personId) setPaidByPersonId(personId);
                setPayerAmounts({});
              } else if (t === "expense" && personId) {
                const partnerId = getPartnerId(personId);
                setPaidByPersonId(partnerId);
                if (partnerId && totalAmount > 0) {
                  setPayerAmounts({ [partnerId]: String(totalAmount) });
                }
              }
            }}
              className={`flex-1 py-2 text-sm font-display font-semibold capitalize transition-all ${type === t
                ? t === "expense" ? "bg-coral text-white" : "bg-volt text-obsidian-950"
                : "text-white/40 hover:text-white/70"}`}>
              {t}
            </button>
          ))}
        </div>

        <Button type="button" variant="secondary" size="sm" onClick={applySharedGroupPreset}>
          Shared group preset
        </Button>

        <Input label="Amount (NZD)" type="number" min="0" step="0.01" placeholder="0.00"
          value={amount} onChange={(e) => {
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

        <Select label="Category" value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          options={CATEGORIES.filter((c) =>
            type === "income" ? ["salary", "freelance", "investment", "other"].includes(c.value)
              : !["salary", "freelance", "investment"].includes(c.value)
          )} />

        <Select label="Person" value={personId} onChange={(e) => {
          const selectedPersonId = e.target.value;
          setPersonId(selectedPersonId);
          if (!selectedPersonId) {
            setPaidByPersonId("");
            return;
          }
          if (type === "income") {
            setPaidByPersonId(selectedPersonId);
            return;
          }
          const partnerId = getPartnerId(selectedPersonId);
          setPaidByPersonId(partnerId);
          if (splitType === "personal" && partnerId && totalAmount > 0) {
            setPayerAmounts({ [partnerId]: String(totalAmount) });
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
                setAutoSplitEqually(false);
                const payerId = paidByPersonId || getPartnerId(personId) || personId;
                setPaidByPersonId(payerId);
                if (payerId) {
                  setPayerAmounts({ [payerId]: String(totalAmount || "") });
                }
              } else if (nextSplitType === "shared_all_equal") {
                setAutoSplitEqually(true);
                const payerId = paidByPersonId || getPartnerId(personId) || personId;
                if (payerId && totalAmount > 0) {
                  setPayerAmounts({ [payerId]: String(totalAmount) });
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
            <div className="flex items-center gap-2 mb-2">
              <input
                id="auto-split-equally"
                type="checkbox"
                checked={autoSplitEqually}
                onChange={() => setAutoSplitEqually((v) => !v)}
                className="accent-volt"
              />
              <label htmlFor="auto-split-equally" className="text-xs text-white/70 font-body cursor-pointer select-none">
                Auto split equally
              </label>
            </div>
            <p className="text-xs text-white/40 font-body">
              Enter who paid and how much each person paid.
            </p>
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
                      if (autoSplitEqually) return;
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
                    disabled={autoSplitEqually}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={totalAmount > 0 ? Math.round((getPayerAmount(person.id) / totalAmount) * 100) : 0}
                      onChange={(e) => { if (!autoSplitEqually) rebalancePayerAmountsFromSlider(person.id, Number(e.target.value)); }}
                      disabled={totalAmount <= 0 || autoSplitEqually}
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

        <Input label="Description" placeholder="What was this for?" value={description}
          onChange={(e) => setDescription(e.target.value)} />

        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

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
            {loading ? "Adding..." : "Add Transaction"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
