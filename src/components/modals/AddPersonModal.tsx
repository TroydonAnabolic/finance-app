"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";
import { PERSON_COLORS } from "@/lib/utils";
import toast from "react-hot-toast";

interface Props { open: boolean; onClose: () => void; }

export function AddPersonModal({ open, onClose }: Props) {
  const { budgets, addPerson, people } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [colorIdx, setColorIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error("Enter a name");
    setLoading(true);
    try {
      await addPerson({ name: name.trim(), email, budgetId: budgetId || null, color: PERSON_COLORS[colorIdx % PERSON_COLORS.length] });
      toast.success("Person added");
      setName(""); setEmail(""); setBudgetId("");
      onClose();
    } catch {
      toast.error("Failed to add person");
    }
    setLoading(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Person">
      <div className="flex flex-col gap-4">
        <Input label="Name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email (optional)" type="email" placeholder="person@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />

        <Select label="Assign to Budget" value={budgetId} onChange={(e) => setBudgetId(e.target.value)}
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
          <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? "Adding..." : "Add Person"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
