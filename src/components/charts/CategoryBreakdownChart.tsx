"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { CategoryData } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

interface Props { data: CategoryData[]; }

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-obsidian-800 border border-obsidian-600 rounded-xl p-3 text-xs font-body shadow-xl">
      <p className="font-display font-bold text-white capitalize mb-1">{d.category}</p>
      <p style={{ color: d.color }}>{formatCurrency(d.amount)} · {d.percentage.toFixed(1)}%</p>
    </div>
  );
};

export function CategoryBreakdownChart({ data }: Props) {
  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-white mb-5 text-sm uppercase tracking-wider">Category Breakdown</h3>
      <div className="flex gap-6 items-center">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="amount">
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {data.slice(0, 7).map((d) => (
            <div key={d.category} className="flex items-center gap-2 text-xs font-body">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-white/60 capitalize flex-1 truncate">{d.category}</span>
              <span className="text-white/40 font-mono">{d.percentage.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
