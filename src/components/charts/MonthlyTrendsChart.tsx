"use client";
import { ComposedChart, Area, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { MonthlyData } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

interface Props { data: MonthlyData[]; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-obsidian-800 border border-obsidian-600 rounded-xl p-3 text-xs font-body shadow-xl">
      <p className="font-display font-bold text-white mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center justify-between gap-4">
          <span>{p.name}</span><span className="font-mono">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export function MonthlyTrendsChart({ data }: Props) {
  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-white mb-5 text-sm uppercase tracking-wider">Monthly Trends</h3>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#c8ff00" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#c8ff00" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#28284a" />
          <XAxis dataKey="month" tick={{ fill: "#ffffff40", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#ffffff40", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: "#ffffff66", fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#ffffff26" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="income" name="Income" stroke="#c8ff00" strokeWidth={2} fill="url(#gIncome)" />
          <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ff6b6b" strokeWidth={2} fill="url(#gExpense)" />
          <Line
            type="monotone"
            dataKey="net"
            name="Net"
            stroke="#00d4ff"
            strokeWidth={2.2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
