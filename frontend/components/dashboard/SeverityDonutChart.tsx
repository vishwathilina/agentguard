"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Scan } from "@/types";

const COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High:     "#f97316",
  Medium:   "#eab308",
  Low:      "#60a5fa",
  Info:     "#6b7280",
};

interface Props {
  scans: Scan[];
}

export function SeverityDonutChart({ scans }: Props) {
  const totals = scans.reduce(
    (acc, s) => ({
      Critical: acc.Critical + s.totalCritical,
      High:     acc.High     + s.totalHigh,
      Medium:   acc.Medium   + s.totalMedium,
      Low:      acc.Low      + s.totalLow,
      Info:     acc.Info     + s.totalInfo,
    }),
    { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 }
  );

  const data = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-center h-64 text-gray-500 text-sm">
        No vulnerabilities found yet.
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Severity Distribution</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
            labelStyle={{ color: "#fff" }}
            itemStyle={{ color: "#d1d5db" }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "#9ca3af" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
