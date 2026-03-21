"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { AddPersonModal } from "@/components/modals/AddPersonModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCurrency, getPersonContributions } from "@/lib/utils";
import { Plus, Pencil, Trash2, User } from "lucide-react";
import type { Person } from "@/types";
import { PERSON_COLORS } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";

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
  const { people, transactions, budgets, removePerson } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);

  const contributions = useMemo(() => getPersonContributions(transactions, people), [transactions, people]);
  const budgetMap = useMemo(() => Object.fromEntries(budgets.map((b) => [b.id, b])), [budgets]);

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
          <p className="text-white/40 font-body text-sm mt-0.5">{people.length} members</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add Person
        </Button>
      </div>

      {people.length === 0 ? (
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

              <div className="grid grid-cols-3 gap-2 text-center">
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
