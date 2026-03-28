"use client";
import { useState, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useApp } from "@/context/AppContext";
import { importTransactionsFromCSV, type ImportedTransaction } from "@/lib/csv";
import { Upload, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";
import type { SplitType } from "@/types";

interface Props { open: boolean; onClose: () => void; }

export function ImportCSVModal({ open, onClose }: Props) {
  const { activeBudget, people, addTransaction } = useApp();
  const [preview, setPreview] = useState<ImportedTransaction[]>([]);
  const [personId, setPersonId] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const budgetPeople = people.filter((p) => p.budgetId === activeBudget?.id);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importTransactionsFromCSV(file);
      setPreview(rows.slice(0, 5));
    } catch { toast.error("Failed to parse CSV"); }
  };

  const handleImport = async () => {
    if (!activeBudget || !personId || preview.length === 0) return toast.error("Select a person first");
    setLoading(true);
    try {
      const resolvePaidByPersonId = (value?: string) => {
        const raw = (value || "").trim();
        if (!raw) return personId;
        const byId = budgetPeople.find((p) => p.id === raw);
        if (byId) return byId.id;
        const byName = budgetPeople.find((p) => p.name.toLowerCase() === raw.toLowerCase());
        if (byName) return byName.id;
        return personId;
      };

      const resolveSplitType = (value: string | undefined, txType: "income" | "expense"): SplitType => {
        if (txType !== "expense") return "personal";
        const normalized = (value || "").toLowerCase().trim();
        return normalized === "shared_all_equal" || normalized === "shared_equal" || normalized === "shared" || normalized === "50/50"
          ? "shared_all_equal"
          : "personal";
      };

      const resolvePaidByBreakdown = (value: string | undefined, fallbackPayerId: string, txAmount: number) => {
        const fallback = fallbackPayerId
          ? [{ personId: fallbackPayerId, amount: txAmount }]
          : [];

        const raw = (value || "").trim();
        if (!raw) return fallback;

        try {
          const parsed = JSON.parse(raw) as Array<{ personId?: string; name?: string; amount?: number | string }>;
          if (!Array.isArray(parsed)) return fallback;

          const byPerson: Record<string, number> = {};
          parsed.forEach((entry) => {
            const rawAmount = Number(entry.amount);
            if (!Number.isFinite(rawAmount) || rawAmount <= 0) return;
            let resolvedPersonId = "";
            if (entry.personId) {
              const byId = budgetPeople.find((p) => p.id === entry.personId);
              if (byId) resolvedPersonId = byId.id;
            }
            if (!resolvedPersonId && entry.name) {
              const byName = budgetPeople.find((p) => p.name.toLowerCase() === entry.name!.toLowerCase());
              if (byName) resolvedPersonId = byName.id;
            }
            if (!resolvedPersonId) return;
            byPerson[resolvedPersonId] = (byPerson[resolvedPersonId] || 0) + rawAmount;
          });

          const entries = Object.entries(byPerson)
            .filter(([, valueAmount]) => valueAmount > 0)
            .map(([entryPersonId, valueAmount]) => ({ personId: entryPersonId, amount: Number(valueAmount.toFixed(2)) }));

          return entries.length > 0 ? entries : fallback;
        } catch {
          return fallback;
        }
      };

      await Promise.all(preview.map((t) => addTransaction({
        budgetId: activeBudget.id, personId,
        type: t.type, amount: t.amount,
        category: t.category as any, description: t.description, date: t.date,
        paidByPersonId: (() => {
          const fallbackPayerId = resolvePaidByPersonId(t.paidBy);
          if (t.type !== "expense") return personId;
          const paidByBreakdown = resolvePaidByBreakdown(t.paidByBreakdown, fallbackPayerId, t.amount);
          return paidByBreakdown[0]?.personId || fallbackPayerId;
        })(),
        paidByBreakdown: (() => {
          if (t.type !== "expense") return null;
          const fallbackPayerId = resolvePaidByPersonId(t.paidBy);
          return resolvePaidByBreakdown(t.paidByBreakdown, fallbackPayerId, t.amount);
        })(),
        splitType: resolveSplitType(t.splitType, t.type),
      })));
      toast.success(`Imported ${preview.length} transactions`);
      setPreview([]); onClose();
    } catch { toast.error("Import failed"); }
    setLoading(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Import CSV" className="max-w-lg">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-white/40 font-body">
          CSV should have columns: Date, Type (income/expense), Amount, Category, Description
        </p>

        <div onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-obsidian-600 hover:border-volt/40 rounded-xl p-8 text-center cursor-pointer transition-colors group">
          <Upload size={24} className="mx-auto mb-2 text-white/20 group-hover:text-volt/60 transition-colors" />
          <p className="text-sm font-body text-white/40">Click to upload CSV file</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>

        {preview.length > 0 && (
          <>
            <Select label="Assign all to person" value={personId} onChange={(e) => setPersonId(e.target.value)}
              options={[{ value: "", label: "Select person..." }, ...budgetPeople.map((p) => ({ value: p.id, label: p.name }))]} />
            <div className="bg-obsidian-900 rounded-lg p-3 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              <p className="text-xs font-display font-semibold text-white/40 mb-1">PREVIEW ({preview.length} rows)</p>
              {preview.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-body py-1 border-b border-obsidian-700 last:border-0">
                  <span className="text-white/60 truncate flex-1">{t.description || t.category}</span>
                  <span className={t.type === "income" ? "text-volt font-mono ml-2" : "text-coral font-mono ml-2"}>
                    {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleImport} disabled={loading || preview.length === 0}>
            {loading ? "Importing..." : `Import ${preview.length} rows`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
