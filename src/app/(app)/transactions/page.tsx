"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { AddTransactionModal } from "@/components/modals/AddTransactionModal";
import { EditTransactionModal } from "@/components/modals/EditTransactionModal";
import { ImportCSVModal } from "@/components/modals/ImportCSVModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { CATEGORY_COLORS, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { exportTransactionsToCSV } from "@/lib/csv";
import { Plus, Upload, Download, Search, Pencil, Trash2, RefreshCw } from "lucide-react";
import type { Transaction } from "@/types";
import toast from "react-hot-toast";

type ColumnId = "dateTime" | "description" | "category" | "person" | "amount" | "recurrence" | "recurrenceGroup";

type ViewMode = "completed" | "upcoming" | "all";

const COLUMN_CONFIG: { id: ColumnId; label: string }[] = [
  { id: "dateTime", label: "Date & Time" },
  { id: "description", label: "Description" },
  { id: "category", label: "Category" },
  { id: "person", label: "Person" },
  { id: "amount", label: "Amount" },
  { id: "recurrence", label: "Recurrence Status" },
  { id: "recurrenceGroup", label: "Recurrence Group" },
];

const DEFAULT_VISIBLE_COLUMNS: Record<ColumnId, boolean> = {
  dateTime: true,
  description: true,
  category: true,
  person: true,
  amount: true,
  recurrence: false,
  recurrenceGroup: false,
};

export default function TransactionsPage() {
  const { transactions, people, budgets, activeBudget, removeTransaction, refresh } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  // Transaction view mode: completed, upcoming, all
  const [viewMode, setViewMode] = useState<ViewMode>("completed");
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
const [refreshing, setRefreshing] = useState(false);

  const budgetTx = useMemo(() =>
    activeBudget ? transactions.filter((t) => t.budgetId === activeBudget.id) : [],
    [transactions, activeBudget]
  );

  function parseTxDate(value: string): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isDateOnly(value: string): boolean {
    return !value.includes("T");
  }

  function addToDate(date: Date, frequency: NonNullable<Transaction["recurrence"]>["frequency"], interval: number): Date {
    const next = new Date(date);
    switch (frequency) {
      case "minute":
        next.setMinutes(next.getMinutes() + interval);
        break;
      case "hour":
        next.setHours(next.getHours() + interval);
        break;
      case "daily":
        next.setDate(next.getDate() + interval);
        break;
      case "weekly":
        next.setDate(next.getDate() + interval * 7);
        break;
      case "monthly":
        next.setMonth(next.getMonth() + interval);
        break;
      case "yearly":
        next.setFullYear(next.getFullYear() + interval);
        break;
      default:
        break;
    }
    return next;
  }

  function toStoredDateValue(nextDate: Date, frequency: NonNullable<Transaction["recurrence"]>["frequency"]): string {
    if (frequency === "minute" || frequency === "hour") {
      return nextDate.toISOString();
    }
    return nextDate.toISOString().slice(0, 10);
  }

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const matchesFilters = (t: Transaction) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (catFilter !== "all" && t.category !== catFilter) return false;
      if (
        search &&
        !t.description.toLowerCase().includes(search.toLowerCase()) &&
        !t.category.includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    };

    const isTemplate = (t: Transaction) => t.recurrenceStatus === "template" || !!t.isRecurring;
    const isOccurrenceLike = (t: Transaction) => t.recurrenceStatus === "occurrence" || !!t.recurrenceSourceId;

    const isFuture = (t: Transaction) => {
      const date = parseTxDate(t.date);
      if (!date) return false;
      if (isDateOnly(t.date)) {
        return date.getTime() > startOfToday.getTime();
      }
      return date.getTime() > now.getTime();
    };

    const belongsToTemplate = (candidate: Transaction, template: Transaction) => {
      const templateGroupId = template.recurrenceGroupId || template.id;
      return (
        candidate.id !== template.id &&
        (candidate.recurrenceSourceId === template.id ||
          (!!candidate.recurrenceGroupId && candidate.recurrenceGroupId === templateGroupId))
      );
    };

    const base = budgetTx.filter(matchesFilters);
    const templates = base.filter((t) => isTemplate(t) && !!t.recurrence?.frequency);

    const keepFutureRecurringIds = new Set<string>();
    const recurringSeriesGroups = new Set<string>();
    const syntheticUpcoming: Transaction[] = [];

    templates.forEach((template) => {
      const groupId = template.recurrenceGroupId || template.id;
      recurringSeriesGroups.add(groupId);

      const seriesCandidates = base.filter((t) => isOccurrenceLike(t) && belongsToTemplate(t, template));
      const futureCandidates = seriesCandidates
        .filter((t) => isFuture(t))
        .sort((a, b) => {
          const aTime = parseTxDate(a.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bTime = parseTxDate(b.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });

      if (futureCandidates.length > 0) {
        keepFutureRecurringIds.add(futureCandidates[0].id);
        return;
      }

      const recurrence = template.recurrence;
      if (!recurrence?.frequency) return;
      const interval = recurrence.interval && recurrence.interval > 0 ? recurrence.interval : 1;

      const templateDate = parseTxDate(template.date);
      if (!templateDate) return;

      let nextDate = new Date(templateDate);
      let guard = 0;
      while (guard < 1000 && (isDateOnly(template.date)
        ? nextDate.getTime() <= startOfToday.getTime()
        : nextDate.getTime() <= now.getTime())) {
        nextDate = addToDate(nextDate, recurrence.frequency, interval);
        guard += 1;
      }

      if (guard >= 1000) return;
      const endDate = recurrence.endsOn ? parseTxDate(recurrence.endsOn) : null;
      if (endDate && nextDate.getTime() > endDate.getTime()) return;

      syntheticUpcoming.push({
        ...template,
        id: `synthetic-next-${template.id}`,
        date: toStoredDateValue(nextDate, recurrence.frequency),
        isRecurring: false,
        recurrenceStatus: "occurrence",
        recurrenceGroupId: groupId,
        recurrenceSourceId: template.id,
        createdAt: new Date().toISOString(),
      });
    });

    const includeByMode = (t: Transaction) => {
      if (viewMode === "completed") {
        return !isFuture(t);
      }

      if (viewMode === "upcoming") {
        if (isTemplate(t)) return false;
        if (!isFuture(t)) return false;

        if (isOccurrenceLike(t)) {
          const groupId = t.recurrenceGroupId || "";
          if (groupId && recurringSeriesGroups.has(groupId)) {
            return keepFutureRecurringIds.has(t.id);
          }
        }

        return true;
      }

      // all
      if (isFuture(t) && isOccurrenceLike(t)) {
        const groupId = t.recurrenceGroupId || "";
        if (groupId && recurringSeriesGroups.has(groupId)) {
          return keepFutureRecurringIds.has(t.id);
        }
      }

      return true;
    };

    const fromStored = base.filter(includeByMode);
    return (viewMode === "upcoming" || viewMode === "all")
      ? [...fromStored, ...syntheticUpcoming]
      : fromStored;
  }, [budgetTx, typeFilter, catFilter, search, viewMode]);

  // Selection state (must be after filtered)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allVisibleIds = useMemo(() => filtered.map((t) => t.id), [filtered]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = allVisibleIds.some((id) => selected.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };
  const toggleSelectOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
    // Close columns menu on outside click
    useEffect(() => {
      if (!showColumnMenu) return;
      function handleClick(e: MouseEvent) {
        if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
          setShowColumnMenu(false);
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [showColumnMenu]);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>(DEFAULT_VISIBLE_COLUMNS);

  const personMap = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    await removeTransaction(id);
    toast.success("Deleted");
  };

  // Delete selected transactions
  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected transaction(s)?`)) return;
    for (const id of selected) {
      await removeTransaction(id);
    }
    setSelected(new Set());
    toast.success(`Deleted ${selected.size} transaction(s)`);
  };

  const categories = [...new Set(budgetTx.map((t) => t.category))];

  const toggleColumn = (columnId: ColumnId) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  };

  const recurrenceLabel = (t: Transaction) => {
    if (t.recurrenceStatus === "occurrence" || !!t.recurrenceSourceId) {
      return "Recurring occurrence";
    }
    const isTemplate = t.recurrenceStatus === "template" || !!t.isRecurring || !!t.recurrence;
    if (isTemplate && t.recurrence?.frequency) {
      return `Template: ${t.recurrence.frequency} (${t.recurrence.interval || 1}x)`;
    }
    if (isTemplate) {
      return "Recurring template";
    }
    if (t.recurrenceStatus === "one_time") return "One-time";
    if (!t.recurrence && !t.isRecurring) return "One-time";
    if (t.recurrence?.frequency) {
      return `${t.recurrence.frequency} (${t.recurrence.interval || 1}x)`;
    }
    return "One-time";
  };

  const recurrenceGroupLabel = (t: Transaction) => {
    const groupId = t.recurrenceGroupId || null;
    if (!groupId) return "-";
    if (groupId.length <= 12) return groupId;
    return `${groupId.slice(0, 8)}...${groupId.slice(-4)}`;
  };

  const isSyntheticUpcoming = (t: Transaction) => t.id.startsWith("synthetic-next-");

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-2xl text-white">Transactions</h1>
          <p className="text-white/40 font-body text-sm mt-0.5">{filtered.length} records</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative" ref={columnMenuRef}>
            <Button variant="secondary" size="sm" onClick={() => setShowColumnMenu((prev) => !prev)}>
              Columns
            </Button>
            {showColumnMenu && (
              <div className="absolute right-0 mt-2 w-52 rounded-lg border border-obsidian-600 bg-obsidian-900 p-3 z-20 shadow-lg">
                <p className="text-xs font-display font-semibold text-white/50 uppercase tracking-wider mb-2">Show columns</p>
                <div className="flex flex-col gap-2">
                  {COLUMN_CONFIG.map((column) => (
                    <label key={column.id} className="flex items-center gap-2 text-sm text-white/80 font-body cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns[column.id]}
                        onChange={() => toggleColumn(column.id)}
                        className="accent-lime-400"
                      />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
            <Upload size={13} /> Import CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportTransactionsToCSV(budgetTx, people, budgets)}>
            <Download size={13} /> Export
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={13} /> Add
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-obsidian-800 border border-obsidian-600 text-white placeholder-white/20 rounded-lg pl-9 pr-3 py-2 text-sm font-body outline-none focus:border-volt/60"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-obsidian-800 border border-obsidian-600 text-white/70 rounded-lg px-3 py-2 text-sm font-body outline-none focus:border-volt/60 cursor-pointer">
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="bg-obsidian-800 border border-obsidian-600 text-white/70 rounded-lg px-3 py-2 text-sm font-body outline-none focus:border-volt/60 cursor-pointer">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
      </div>

      {/* View mode, Refresh and Delete Selected buttons */}
      <div className="flex items-center mb-2 gap-2">
        {/* View mode dropdown */}
        <select
          value={viewMode}
          onChange={e => setViewMode(e.target.value as ViewMode)}
          className="bg-obsidian-800 border border-obsidian-600 text-white/70 rounded-lg px-3 py-2 text-sm font-body outline-none focus:border-volt/60 cursor-pointer"
          style={{ minWidth: 120 }}
        >
          <option value="completed">Completed</option>
          <option value="upcoming">Upcoming</option>
          <option value="all">All</option>
        </select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={async () => {
            setRefreshing(true);
            try {
              await refresh();
            } finally {
              setRefreshing(false);
            }
          }}
          disabled={refreshing}
          title="Refresh transactions"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={selected.size === 0}
          onClick={handleDeleteSelected}
        >
          <Trash2 size={13} className="mr-1" /> Delete
        </Button>
      </div>
      
      {/* Table */}
      <div className="bg-obsidian-800/60 border border-obsidian-600/50 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-white/30 font-body text-sm">
            {budgetTx.length === 0 ? "No transactions yet. Add your first one!" : "No transactions match your filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-obsidian-600/50">
                  {/* Select all checkbox */}
                  <th className="w-10 px-3 py-3 align-middle text-xs font-display font-semibold text-white/30 uppercase tracking-wider">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = !allSelected && someSelected; }}
                        onChange={toggleSelectAll}
                        aria-label="Select all"
                        className="accent-lime-400"
                      />
                    </div>
                  </th>
                  {visibleColumns.dateTime && <th className="text-left px-4 py-3 text-xs font-display font-semibold text-white/30 uppercase tracking-wider">Date & Time</th>}
                  {visibleColumns.description && <th className="text-left px-4 py-3 text-xs font-display font-semibold text-white/30 uppercase tracking-wider">Description</th>}
                  {visibleColumns.category && <th className="text-left px-4 py-3 text-xs font-display font-semibold text-white/30 uppercase tracking-wider">Category</th>}
                  {visibleColumns.person && <th className="text-left px-4 py-3 text-xs font-display font-semibold text-white/30 uppercase tracking-wider">Person</th>}
                  {visibleColumns.amount && <th className="text-left px-4 py-3 text-xs font-display font-semibold text-white/30 uppercase tracking-wider">Amount</th>}
                  {visibleColumns.recurrence && <th className="text-left px-4 py-3 text-xs font-display font-semibold text-white/30 uppercase tracking-wider">Recurrence</th>}
                  {visibleColumns.recurrenceGroup && <th className="text-left px-4 py-3 text-xs font-display font-semibold text-white/30 uppercase tracking-wider">Recurrence Group</th>}
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-white/30 uppercase tracking-wider" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const person = personMap[t.personId];
                  const isChecked = selected.has(t.id);
                  return (
                    <tr key={t.id} className="border-b border-obsidian-700/50 last:border-0 hover:bg-obsidian-700/30 transition-colors group">
                      {/* Select one checkbox */}
                      <td className="w-10 px-3 py-3 align-middle">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(t.id)}
                            aria-label="Select transaction"
                            className="accent-lime-400"
                          />
                        </div>
                      </td>
                      {visibleColumns.dateTime && <td className="px-4 py-3 text-xs font-mono text-white/40 whitespace-nowrap">{formatDateTime(t.date)}</td>}
                      {visibleColumns.description && (
                        <td className="px-4 py-3 text-sm font-body text-white max-w-[260px]">
                          <div className="truncate">{t.description || "—"}</div>
                          {isSyntheticUpcoming(t) && (
                            <div className="text-[10px] uppercase tracking-wider text-volt/80 mt-0.5">Next scheduled</div>
                          )}
                        </td>
                      )}
                      {visibleColumns.category && (
                        <td className="px-4 py-3">
                          <Badge label={t.category} color={CATEGORY_COLORS[t.category]} />
                        </td>
                      )}
                      {visibleColumns.person && (
                        <td className="px-4 py-3">
                          {person && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: person.color }} />
                              <span className="text-xs font-body text-white/60">{person.name}</span>
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.amount && (
                        <td className="px-4 py-3 text-sm font-mono font-semibold whitespace-nowrap"
                          style={{ color: t.type === "income" ? "#c8ff00" : "#ff6b6b" }}>
                          {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                        </td>
                      )}
                      {visibleColumns.recurrence && (
                        <td className="px-4 py-3 text-xs font-body text-white/60 whitespace-nowrap">
                          {recurrenceLabel(t)}
                        </td>
                      )}
                      {visibleColumns.recurrenceGroup && (
                        <td className="px-4 py-3 text-xs font-mono text-white/50 whitespace-nowrap" title={t.recurrenceGroupId || ""}>
                          {recurrenceGroupLabel(t)}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditTx(t)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-obsidian-600 transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(t.id)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-coral hover:bg-coral/10 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditTransactionModal open={!!editTx} onClose={() => setEditTx(null)} transaction={editTx} />
      <ImportCSVModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
