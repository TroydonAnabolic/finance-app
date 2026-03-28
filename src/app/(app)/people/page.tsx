"use client";
import { useMemo, useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { AddPersonModal } from "@/components/modals/AddPersonModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, User, Scale, ArrowRightLeft } from "lucide-react";
import type { Person, Transaction } from "@/types";
import { PERSON_COLORS } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";

type DebtTrackerConfig = {
  debtorId: string;
  creditorId: string;
  openingDebt: number;
};

type ContributionRow = {
  person: Person;
  income: number;
  expenses: number;
  net: number;
  percentage: number;
};

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getExpenseShares(tx: Transaction, budgetMemberIds: string[]): Record<string, number> {
  if (tx.type !== "expense") return {};
  const assignedPersonId = tx.personId;
  const paidByPersonId = tx.paidByPersonId || tx.personId;

  if (tx.splitType === "shared_all_equal") {
    if (budgetMemberIds.length === 0) return { [assignedPersonId]: tx.amount };
    const equalShare = Number((tx.amount / budgetMemberIds.length).toFixed(2));
    const shares: Record<string, number> = {};
    budgetMemberIds.forEach((memberId, index) => {
      if (index === budgetMemberIds.length - 1) {
        const subtotal = equalShare * (budgetMemberIds.length - 1);
        shares[memberId] = Number((tx.amount - subtotal).toFixed(2));
      } else {
        shares[memberId] = equalShare;
      }
    });
    return shares;
  }

  if (tx.splitType === "shared_equal" && paidByPersonId && paidByPersonId !== assignedPersonId) {
    const half = tx.amount / 2;
    return {
      [assignedPersonId]: half,
      [paidByPersonId]: half,
    };
  }

  return { [assignedPersonId]: tx.amount };
}

function getPaymentContributions(tx: Transaction): Record<string, number> {
  if (tx.type !== "expense") return {};

  if (tx.paidByBreakdown?.length) {
    const contributions: Record<string, number> = {};
    tx.paidByBreakdown.forEach((entry) => {
      if (!entry.personId || !Number.isFinite(entry.amount) || entry.amount <= 0) return;
      contributions[entry.personId] = (contributions[entry.personId] || 0) + entry.amount;
    });
    if (Object.keys(contributions).length > 0) {
      return contributions;
    }
  }

  const payerId = tx.paidByPersonId || tx.personId;
  return payerId ? { [payerId]: tx.amount } : {};
}

function EditPersonModal({ open, onClose, person }: { open: boolean; onClose: () => void; person: Person | null }) {
  const { budgets, editPerson } = useApp();
  const [name, setName] = useState(person?.name || "");
  const [email, setEmail] = useState(person?.email || "");
  const [budgetId, setBudgetId] = useState(person?.budgetId || "");
  const [colorIdx, setColorIdx] = useState(PERSON_COLORS.indexOf(person?.color || PERSON_COLORS[0]));

  useMemo(() => {
    if (person) { setName(person.name); setEmail(person.email || ""); setBudgetId(person.budgetId || ""); setColorIdx(PERSON_COLORS.indexOf(person.color)); }
  }, [person]);

  const handleSave = async () => {
    if (!person) return;
    await editPerson(person.id, { name, email, budgetId: budgetId || null, color: PERSON_COLORS[colorIdx] });
    toast.success("Person updated");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Person">
      <div className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select label="Budget" value={budgetId} onChange={(e) => setBudgetId(e.target.value)}
          options={[{ value: "", label: "No budget" }, ...budgets.map((b) => ({ value: b.id, label: b.name }))]} />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-display font-semibold text-white/50 uppercase tracking-wider">Color</span>
          <div className="flex gap-2 flex-wrap">
            {PERSON_COLORS.map((c, i) => (
              <button key={i} onClick={() => setColorIdx(i)}
                className={`w-7 h-7 rounded-full transition-all ${colorIdx === i ? "ring-2 ring-white ring-offset-2 ring-offset-obsidian-800 scale-110" : "hover:scale-105"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function PeoplePage() {
  const { people, transactions, budgets, activeBudget, removePerson } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [debtConfig, setDebtConfig] = useState<DebtTrackerConfig>({ debtorId: "", creditorId: "", openingDebt: 0 });
  const [openingDebtInput, setOpeningDebtInput] = useState("0");
  const [repaymentInput, setRepaymentInput] = useState("");
  const [debtConfigHydrated, setDebtConfigHydrated] = useState(false);
  const [cashAssetBaseByPerson, setCashAssetBaseByPerson] = useState<Record<string, number>>({});
  const [cashAssetsHydrated, setCashAssetsHydrated] = useState(false);

  const budgetPeople = useMemo(() => {
    if (!activeBudget) return people;
    return people.filter((p) => p.budgetId === activeBudget.id);
  }, [people, activeBudget]);

  const budgetTransactions = useMemo(() => {
    if (!activeBudget) return transactions;
    return transactions.filter((t) => t.budgetId === activeBudget.id);
  }, [transactions, activeBudget]);

  const completedBudgetTransactions = useMemo(() => {
    const now = new Date();
    return budgetTransactions.filter((t) => {
      if (t.recurrenceStatus === "template" || !!t.isRecurring) return false;
      const dt = parseDate(t.date);
      if (!dt) return true;
      return dt.getTime() <= now.getTime();
    });
  }, [budgetTransactions]);

  const configStorageKey = useMemo(() => `ledger-debt-tracker:${activeBudget?.id || "global"}`, [activeBudget]);
  const cashAssetsStorageKey = useMemo(() => `ledger-cash-assets:${activeBudget?.id || "global"}`, [activeBudget]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(configStorageKey);
    if (!raw) {
      const fallbackDebtor = budgetPeople[0]?.id || "";
      const fallbackCreditor = budgetPeople.find((p) => p.id !== fallbackDebtor)?.id || "";
      const defaultConfig = { debtorId: fallbackDebtor, creditorId: fallbackCreditor, openingDebt: 0 };
      setDebtConfig(defaultConfig);
      setOpeningDebtInput("0");
      setDebtConfigHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DebtTrackerConfig>;
      const debtorId = parsed.debtorId && budgetPeople.some((p) => p.id === parsed.debtorId)
        ? parsed.debtorId
        : (budgetPeople[0]?.id || "");
      const creditorId = parsed.creditorId && budgetPeople.some((p) => p.id === parsed.creditorId)
        ? parsed.creditorId
        : (budgetPeople.find((p) => p.id !== debtorId)?.id || "");
      const openingDebt = Number.isFinite(Number(parsed.openingDebt)) ? Number(parsed.openingDebt) : 0;
      setDebtConfig({ debtorId, creditorId, openingDebt });
      setOpeningDebtInput(String(openingDebt));
      setDebtConfigHydrated(true);
    } catch {
      const fallbackDebtor = budgetPeople[0]?.id || "";
      const fallbackCreditor = budgetPeople.find((p) => p.id !== fallbackDebtor)?.id || "";
      setDebtConfig({ debtorId: fallbackDebtor, creditorId: fallbackCreditor, openingDebt: 0 });
      setOpeningDebtInput("0");
      setDebtConfigHydrated(true);
    }
  }, [configStorageKey, budgetPeople]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!debtConfigHydrated) return;
    window.localStorage.setItem(configStorageKey, JSON.stringify(debtConfig));
  }, [debtConfig, configStorageKey, debtConfigHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(cashAssetsStorageKey);
    const defaults = Object.fromEntries(budgetPeople.map((p) => [p.id, 0]));

    if (!raw) {
      setCashAssetBaseByPerson(defaults);
      setCashAssetsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      const normalized: Record<string, number> = { ...defaults };
      budgetPeople.forEach((person) => {
        const value = Number(parsed?.[person.id]);
        normalized[person.id] = Number.isFinite(value) ? value : 0;
      });
      setCashAssetBaseByPerson(normalized);
      setCashAssetsHydrated(true);
    } catch {
      setCashAssetBaseByPerson(defaults);
      setCashAssetsHydrated(true);
    }
  }, [cashAssetsStorageKey, budgetPeople]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!cashAssetsHydrated) return;
    window.localStorage.setItem(cashAssetsStorageKey, JSON.stringify(cashAssetBaseByPerson));
  }, [cashAssetBaseByPerson, cashAssetsHydrated, cashAssetsStorageKey]);

  const expenseSharesByPerson = useMemo(() => {
    const memberIds = budgetPeople.map((p) => p.id);
    const totals: Record<string, number> = Object.fromEntries(budgetPeople.map((p) => [p.id, 0]));
    completedBudgetTransactions.forEach((tx) => {
      if (tx.type !== "expense") return;
      const shares = getExpenseShares(tx, memberIds);
      Object.entries(shares).forEach(([personId, amount]) => {
        totals[personId] = (totals[personId] || 0) + amount;
      });
    });
    return totals;
  }, [completedBudgetTransactions, budgetPeople]);

  const incomeByPerson = useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(budgetPeople.map((p) => [p.id, 0]));
    completedBudgetTransactions.forEach((tx) => {
      if (tx.type !== "income") return;
      totals[tx.personId] = (totals[tx.personId] || 0) + tx.amount;
    });
    return totals;
  }, [completedBudgetTransactions, budgetPeople]);

  const cashFlowByPerson = useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(budgetPeople.map((p) => [p.id, 0]));
    completedBudgetTransactions.forEach((tx) => {
      if (tx.type === "income") {
        totals[tx.personId] = (totals[tx.personId] || 0) + tx.amount;
        return;
      }
      if (tx.type === "expense") {
        const contributions = getPaymentContributions(tx);
        Object.entries(contributions).forEach(([personId, amount]) => {
          totals[personId] = (totals[personId] || 0) - amount;
        });
      }
    });
    return totals;
  }, [completedBudgetTransactions, budgetPeople]);

  const cashAssetTotalsByPerson = useMemo(() => {
    const totals: Record<string, number> = {};
    budgetPeople.forEach((person) => {
      totals[person.id] = (cashAssetBaseByPerson[person.id] || 0) + (cashFlowByPerson[person.id] || 0);
    });
    return totals;
  }, [budgetPeople, cashAssetBaseByPerson, cashFlowByPerson]);

  const contributions = useMemo<ContributionRow[]>(() => {
    const totalExpenses = Object.values(expenseSharesByPerson).reduce((sum, value) => sum + value, 0);
    return budgetPeople
      .map((person) => {
        const income = incomeByPerson[person.id] || 0;
        const expenses = expenseSharesByPerson[person.id] || 0;
        return {
          person,
          income,
          expenses,
          net: income - expenses,
          percentage: totalExpenses > 0 ? (expenses / totalExpenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.expenses - a.expenses);
  }, [budgetPeople, expenseSharesByPerson, incomeByPerson]);

  const budgetMap = useMemo(() => Object.fromEntries(budgets.map((b) => [b.id, b])), [budgets]);

  const debtorExpenses = useMemo(() => {
    if (!debtConfig.debtorId) return 0;
    return expenseSharesByPerson[debtConfig.debtorId] || 0;
  }, [expenseSharesByPerson, debtConfig.debtorId]);

  const creditorExpenses = useMemo(() => {
    if (!debtConfig.creditorId) return 0;
    return expenseSharesByPerson[debtConfig.creditorId] || 0;
  }, [expenseSharesByPerson, debtConfig.creditorId]);

  const debtDeltaFromTransactions = useMemo(() => {
    if (!debtConfig.debtorId || !debtConfig.creditorId) return 0;
    const memberIds = budgetPeople.map((p) => p.id);
    return completedBudgetTransactions.reduce((sum, tx) => {
      if (tx.type !== "expense") return sum;
      const shares = getExpenseShares(tx, memberIds);
      const contributions = getPaymentContributions(tx);

      const debtorShare = shares[debtConfig.debtorId] || 0;
      const creditorShare = shares[debtConfig.creditorId] || 0;
      const debtorContribution = contributions[debtConfig.debtorId] || 0;
      const creditorContribution = contributions[debtConfig.creditorId] || 0;

      const debtorOwesCreditorFromTx = Math.min(creditorContribution, debtorShare);
      const creditorOwesDebtorFromTx = Math.min(debtorContribution, creditorShare);

      return sum + debtorOwesCreditorFromTx - creditorOwesDebtorFromTx;
    }, 0);
  }, [completedBudgetTransactions, debtConfig.debtorId, debtConfig.creditorId, budgetPeople]);

  const owedTotal = useMemo(() => debtConfig.openingDebt + debtDeltaFromTransactions, [debtConfig.openingDebt, debtDeltaFromTransactions]);
  const equalizationGap = useMemo(() => creditorExpenses - debtorExpenses, [creditorExpenses, debtorExpenses]);

  const debtPeopleOptions = budgetPeople.map((p) => ({ value: p.id, label: p.name }));
  const debtorPerson = budgetPeople.find((p) => p.id === debtConfig.debtorId) || null;
  const creditorPerson = budgetPeople.find((p) => p.id === debtConfig.creditorId) || null;

  const setPersonCashAssetBase = (personId: string, value: string) => {
    setCashAssetBaseByPerson((prev) => ({
      ...prev,
      [personId]: parseAmount(value),
    }));
  };

  const applyOpeningDebt = () => {
    const amount = parseAmount(openingDebtInput);
    setDebtConfig((prev) => ({ ...prev, openingDebt: amount }));
    toast.success("Starting debt updated");
  };

  const applyRepayment = () => {
    const repayment = parseAmount(repaymentInput);
    if (repayment <= 0) {
      toast.error("Enter a repayment amount greater than 0");
      return;
    }
    setDebtConfig((prev) => {
      const nextOpeningDebt = prev.openingDebt - repayment;
      setOpeningDebtInput(String(nextOpeningDebt));
      return { ...prev, openingDebt: nextOpeningDebt };
    });
    setRepaymentInput("");
    toast.success("Repayment applied to debt");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this person? Their transactions will remain.")) return;
    await removePerson(id);
    toast.success("Person removed");
  };

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-2xl text-white">People</h1>
          <p className="text-white/40 font-body text-sm mt-0.5">
            {budgetPeople.length} members{activeBudget ? ` in ${activeBudget.name}` : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add Person
        </Button>
      </div>

      {budgetPeople.length >= 2 && (
        <Card className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display font-bold text-white text-lg flex items-center gap-2">
                <Scale size={17} className="text-volt" /> Debt Tracker
              </h2>
              <p className="text-xs text-white/40 font-body mt-0.5">
                Tracks owed balance from completed expenses using Paid by person and Split type.
              </p>
            </div>
            <div className="text-xs text-white/50 font-body">
              Budget: <span className="text-white/70">{activeBudget?.name || "All budgets"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Select
              label="Who owes"
              value={debtConfig.debtorId}
              onChange={(e) => {
                const debtorId = e.target.value;
                setDebtConfig((prev) => {
                  const creditorId = prev.creditorId === debtorId
                    ? (budgetPeople.find((p) => p.id !== debtorId)?.id || "")
                    : prev.creditorId;
                  return { ...prev, debtorId, creditorId };
                });
              }}
              options={debtPeopleOptions}
            />
            <Select
              label="Who is owed"
              value={debtConfig.creditorId}
              onChange={(e) => {
                const creditorId = e.target.value;
                setDebtConfig((prev) => {
                  const debtorId = prev.debtorId === creditorId
                    ? (budgetPeople.find((p) => p.id !== creditorId)?.id || "")
                    : prev.debtorId;
                  return { ...prev, debtorId, creditorId };
                });
              }}
              options={debtPeopleOptions}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2 items-end">
            <Input
              label="Starting debt already owed"
              type="number"
              step="0.01"
              min="0"
              value={openingDebtInput}
              onChange={(e) => setOpeningDebtInput(e.target.value)}
            />
            <Button variant="secondary" size="sm" onClick={applyOpeningDebt}>Save Starting Debt</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-obsidian-900 rounded-lg p-3 border border-obsidian-700/70">
              <p className="text-xs font-body text-white/40 mb-1">Starting debt</p>
              <p className="text-base font-mono font-semibold text-white">{formatCurrency(debtConfig.openingDebt)}</p>
            </div>
            <div className="bg-obsidian-900 rounded-lg p-3 border border-obsidian-700/70">
              <p className="text-xs font-body text-white/40 mb-1">
                Split-aware debt delta from transactions
              </p>
              <p className={`text-base font-mono font-semibold ${debtDeltaFromTransactions >= 0 ? "text-coral" : "text-volt"}`}>
                {debtDeltaFromTransactions >= 0 ? "+" : "-"}{formatCurrency(Math.abs(debtDeltaFromTransactions))}
              </p>
            </div>
            <div className="bg-obsidian-900 rounded-lg p-3 border border-volt/30">
              <p className="text-xs font-body text-white/40 mb-1">
                {debtorPerson?.name || "Debtor"} owes {creditorPerson?.name || "Creditor"} now
              </p>
              <p className="text-base font-mono font-semibold text-volt">{formatCurrency(owedTotal)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-obsidian-700/70 bg-obsidian-900 p-3">
              <p className="text-xs font-body text-white/40 mb-1 flex items-center gap-1.5">
                <ArrowRightLeft size={13} /> Contribution gap (split-aware expenses)
              </p>
              <p className="text-sm font-body text-white/70">
                {creditorPerson?.name || "Creditor"} spent {formatCurrency(creditorExpenses)} and {debtorPerson?.name || "Debtor"} spent {formatCurrency(debtorExpenses)}.
              </p>
              <p className="text-sm font-mono mt-1.5">
                {equalizationGap > 0
                  ? <span className="text-coral">{debtorPerson?.name || "Debtor"} is behind by {formatCurrency(equalizationGap)}</span>
                  : equalizationGap < 0
                    ? <span className="text-volt">{debtorPerson?.name || "Debtor"} is ahead by {formatCurrency(Math.abs(equalizationGap))}</span>
                    : <span className="text-white/70">Both are even on expenses</span>}
              </p>
            </div>

            <div className="rounded-lg border border-obsidian-700/70 bg-obsidian-900 p-3 flex flex-col gap-2">
              <Input
                label="Record repayment"
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount repaid"
                value={repaymentInput}
                onChange={(e) => setRepaymentInput(e.target.value)}
              />
              <Button variant="secondary" size="sm" onClick={applyRepayment}>Apply Repayment</Button>
              <p className="text-[11px] text-white/40 font-body">
                Repayment lowers the starting debt baseline and is saved for this budget.
              </p>
            </div>
          </div>
        </Card>
      )}

      {budgetPeople.length < 2 && (
        <Card className="p-4 text-sm font-body text-white/60">
          Add at least two people in this budget to enable debt tracking.
        </Card>
      )}

      {budgetPeople.length > 0 && (
        <Card className="p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Cash Assets</h2>
            <p className="text-xs text-white/40 font-body mt-0.5">
              Starting cash is editable per person. Total cash asset updates from completed income and paid expenses.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {budgetPeople.map((person) => {
              const cashFlow = cashFlowByPerson[person.id] || 0;
              const totalCashAsset = cashAssetTotalsByPerson[person.id] || 0;
              return (
                <div key={person.id} className="rounded-lg border border-obsidian-700/70 bg-obsidian-900 p-3 flex flex-col gap-2">
                  <p className="text-sm font-display font-semibold text-white">{person.name}</p>
                  <Input
                    label="Starting cash"
                    type="number"
                    min="0"
                    step="0.01"
                    value={String(cashAssetBaseByPerson[person.id] || 0)}
                    onChange={(e) => setPersonCashAssetBase(person.id, e.target.value)}
                  />
                  <div className="text-xs font-body text-white/50">
                    Cash movement: <span className={cashFlow >= 0 ? "text-volt" : "text-coral"}>{cashFlow >= 0 ? "+" : ""}{formatCurrency(cashFlow)}</span>
                  </div>
                  <div className="text-sm font-mono font-semibold text-white">
                    Total cash asset: {formatCurrency(totalCashAsset)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {budgetPeople.length === 0 ? (
        <Card className="py-16 text-center">
          <User size={32} className="mx-auto mb-3 text-white/10" />
          <p className="font-display font-bold text-white">No people yet</p>
          <p className="text-white/40 font-body text-sm mt-1">Add household members or contributors to track spending per person</p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}><Plus size={14} /> Add first person</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contributions.map(({ person, income, expenses, net, percentage }) => (
            <Card key={person.id} className="p-5 flex flex-col gap-4 group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-obsidian-950 text-sm"
                    style={{ backgroundColor: person.color }}>
                    {person.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-display font-bold text-white">{person.name}</p>
                    {person.email && <p className="text-xs font-body text-white/30">{person.email}</p>}
                    {person.budgetId && budgetMap[person.budgetId] && (
                      <p className="text-xs font-body mt-0.5" style={{ color: person.color + "bb" }}>
                        {budgetMap[person.budgetId].name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditPerson(person)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-obsidian-700 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(person.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-coral hover:bg-coral/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-obsidian-900 rounded-lg p-2">
                  <p className="text-xs font-body text-white/30 mb-0.5">Income</p>
                  <p className="text-sm font-mono font-semibold text-volt">{formatCurrency(income)}</p>
                </div>
                <div className="bg-obsidian-900 rounded-lg p-2">
                  <p className="text-xs font-body text-white/30 mb-0.5">Spent</p>
                  <p className="text-sm font-mono font-semibold text-coral">{formatCurrency(expenses)}</p>
                </div>
                <div className="bg-obsidian-900 rounded-lg p-2">
                  <p className="text-xs font-body text-white/30 mb-0.5">Net</p>
                  <p className={`text-sm font-mono font-semibold ${net >= 0 ? "text-volt" : "text-coral"}`}>
                    {net >= 0 ? "+" : ""}{formatCurrency(net)}
                  </p>
                </div>
                <div className="bg-obsidian-900 rounded-lg p-2">
                  <p className="text-xs font-body text-white/30 mb-0.5">Cash Asset</p>
                  <p className="text-sm font-mono font-semibold text-white">{formatCurrency(cashAssetTotalsByPerson[person.id] || 0)}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-body text-white/30 mb-1">
                  <span>Share of total spend</span>
                  <span>{percentage.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-obsidian-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${percentage}%`, backgroundColor: person.color }} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddPersonModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditPersonModal open={!!editPerson} onClose={() => setEditPerson(null)} person={editPerson} />
    </div>
  );
}
