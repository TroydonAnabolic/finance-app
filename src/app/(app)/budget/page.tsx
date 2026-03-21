"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { CategoryBreakdownChart } from "@/components/charts/CategoryBreakdownChart";
import { formatCurrency, getCategoryBreakdown, getYearlySummary, getMonthlySummary } from "@/lib/utils";
import { Plus, Pencil, Trash2, PieChart } from "lucide-react";
import type { Budget } from "@/types";
import toast from "react-hot-toast";

function BudgetCard({ budget, onEdit, onDelete }: { budget: Budget; onEdit: () => void; onDelete: () => void }) {
  const { transactions, people, setActiveBudget, activeBudget } = useApp();
  const isActive = activeBudget?.id === budget.id;
  const budgetTx = useMemo(() => transactions.filter((t) => t.budgetId === budget.id), [transactions, budget]);
  const budgetPeople = useMemo(() => people.filter((p) => p.budgetId === budget.id), [people, budget]);
  const monthly = getMonthlySummary(budgetTx);
  const yearly = getYearlySummary(budgetTx);
  const cats = getCategoryBreakdown(budgetTx);

  return (
    <Card className={`p-5 flex flex-col gap-4 group transition-all ${isActive ? "border-volt/30 bg-obsidian-700/60" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive ? "bg-volt" : "bg-obsidian-700"}`}>
            <PieChart size={16} className={isActive ? "text-obsidian-950" : "text-white/50"} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display font-bold text-white">{budget.name}</p>
              {isActive && <span className="text-[10px] font-display font-semibold text-obsidian-950 bg-volt px-1.5 py-0.5 rounded-full">ACTIVE</span>}
            </div>
            {budget.description && <p className="text-xs font-body text-white/30 mt-0.5">{budget.description}</p>}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-obsidian-600 transition-colors"><Pencil size={13} /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-white/30 hover:text-coral hover:bg-coral/10 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-obsidian-900 rounded-lg p-2">
          <p className="text-xs font-body text-white/30 mb-0.5">People</p>
          <p className="text-lg font-display font-bold text-white">{budgetPeople.length}</p>
        </div>
        <div className="bg-obsidian-900 rounded-lg p-2">
          <p className="text-xs font-body text-white/30 mb-0.5">This Month</p>
          <p className={`text-sm font-mono font-semibold ${monthly.net >= 0 ? "text-volt" : "text-coral"}`}>
            {monthly.net >= 0 ? "+" : ""}{formatCurrency(monthly.net)}
          </p>
        </div>
        <div className="bg-obsidian-900 rounded-lg p-2">
          <p className="text-xs font-body text-white/30 mb-0.5">This Year</p>
          <p className={`text-sm font-mono font-semibold ${yearly.net >= 0 ? "text-volt" : "text-coral"}`}>
            {yearly.net >= 0 ? "+" : ""}{formatCurrency(yearly.net)}
          </p>
        </div>
      </div>

      {cats.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-display font-semibold text-white/30 uppercase tracking-wider">Top categories</p>
          {cats.slice(0, 3).map((c) => (
            <div key={c.category} className="flex items-center gap-2 text-xs font-body">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-white/60 capitalize flex-1">{c.category}</span>
              <span className="text-white/40 font-mono">{formatCurrency(c.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {!isActive && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveBudget(budget)}>
          Switch to this budget
        </Button>
      )}
    </Card>
  );
}

export default function BudgetPage() {
  const { budgets, addBudget, editBudget, removeBudget } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Budget | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return toast.error("Enter a name");
    setLoading(true);
    await addBudget(name.trim(), desc);
    toast.success("Budget created");
    setName(""); setDesc(""); setAddOpen(false); setLoading(false);
  };

  const handleEdit = async () => {
    if (!editTarget || !name.trim()) return;
    setLoading(true);
    await editBudget(editTarget.id, { name: name.trim(), description: desc });
    toast.success("Budget updated");
    setEditTarget(null); setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this budget? Transactions will remain but unassigned.")) return;
    await removeBudget(id);
    toast.success("Budget deleted");
  };

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-2xl text-white">Budgets</h1>
          <p className="text-white/40 font-body text-sm mt-0.5">{budgets.length} budget{budgets.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" onClick={() => { setName(""); setDesc(""); setAddOpen(true); }}>
          <Plus size={14} /> New Budget
        </Button>
      </div>

      {budgets.length === 0 ? (
        <Card className="py-16 text-center">
          <PieChart size={32} className="mx-auto mb-3 text-white/10" />
          <p className="font-display font-bold text-white">No budgets yet</p>
          <p className="text-white/40 font-body text-sm mt-1">Create a budget to start tracking your finances</p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}><Plus size={14} /> Create budget</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {budgets.map((b) => (
            <BudgetCard key={b.id} budget={b}
              onEdit={() => { setEditTarget(b); setName(b.name); setDesc(b.description || ""); }}
              onDelete={() => handleDelete(b.id)} />
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Budget">
        <div className="flex flex-col gap-4">
          <Input label="Name" placeholder="e.g. Household 2025" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description (optional)" placeholder="Brief description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={handleAdd} disabled={loading}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Budget">
        <div className="flex flex-col gap-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={handleEdit} disabled={loading}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
