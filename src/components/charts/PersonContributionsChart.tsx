"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { PersonContribution } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

interface Props { data: PersonContribution[]; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-obsidian-800 border border-obsidian-600 rounded-xl p-3 text-xs font-body shadow-xl">
      <p className="font-display font-bold text-white mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }} className="flex justify-between gap-4">
          <span>{p.name}</span><span className="font-mono">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export function PersonContributionsChart({ data }: Props) {
  const chartData = data.map((d) => ({
    name: d.person.name,
    Income: d.income,
    Expenses: d.expenses,
    color: d.person.color,
  }));

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-white mb-5 text-sm uppercase tracking-wider">Per-Person Contributions</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#28284a" />
          <XAxis dataKey="name" tick={{ fill: "#ffffff40", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#ffffff40", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="Income" fill="#c8ff00" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Expenses" fill="#ff6b6b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
