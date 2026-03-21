"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { AddTransactionModal } from "@/components/modals/AddTransactionModal";
import { EditTransactionModal } from "@/components/modals/EditTransactionModal";
import { ImportCSVModal } from "@/components/modals/ImportCSVModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { CATEGORY_COLORS, formatCurrency, formatDate } from "@/lib/utils";
import { exportTransactionsToCSV } from "@/lib/csv";
import { Plus, Upload, Download, Search, Pencil, Trash2 } from "lucide-react";
import type { Transaction } from "@/types";
import toast from "react-hot-toast";

export default function TransactionsPage() {
  const { transactions, people, budgets, activeBudget, removeTransaction } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");

  const budgetTx = useMemo(() =>
    activeBudget ? transactions.filter((t) => t.budgetId === activeBudget.id) : [],
    [transactions, activeBudget]
  );

  const filtered = useMemo(() => budgetTx.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (catFilter !== "all" && t.category !== catFilter) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.category.includes(search.toLowerCase())) return false;
    return true;
  }), [budgetTx, typeFilter, catFilter, search]);

  const personMap = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    await removeTransaction(id);
    toast.success("Deleted");
  };

  const categories = [...new Set(budgetTx.map((t) => t.category))];

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-2xl text-white">Transactions</h1>
          <p className="text-white/40 font-body text-sm mt-0.5">{filtered.length} records</p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
                  {["Date", "Description", "Category", "Person", "Amount", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-display font-semibold text-white/30 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const person = personMap[t.personId];
                  return (
                    <tr key={t.id} className="border-b border-obsidian-700/50 last:border-0 hover:bg-obsidian-700/30 transition-colors group">
                      <td className="px-4 py-3 text-xs font-mono text-white/40 whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="px-4 py-3 text-sm font-body text-white max-w-[200px] truncate">{t.description || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge label={t.category} color={CATEGORY_COLORS[t.category]} />
                      </td>
                      <td className="px-4 py-3">
                        {person && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: person.color }} />
                            <span className="text-xs font-body text-white/60">{person.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold whitespace-nowrap"
                        style={{ color: t.type === "income" ? "#c8ff00" : "#ff6b6b" }}>
                        {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                      </td>
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
