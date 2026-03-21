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
      await Promise.all(preview.map((t) => addTransaction({
        budgetId: activeBudget.id, personId,
        type: t.type, amount: t.amount,
        category: t.category as any, description: t.description, date: t.date,
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
