"use client";

import { AlertCircle, Flame, AlertTriangle, ArrowDown } from "lucide-react";
import { Scan } from "@/types";

interface Props { scans: Scan[] }

const severities = [
  {
    key: "totalCritical" as keyof Scan,
    label: "CRITICAL",
    icon: AlertCircle,
    color: "#f85149",
    dimColor: "rgba(248,81,73,0.12)",
    borderColor: "rgba(248,81,73,0.25)",
  },
  {
    key: "totalHigh" as keyof Scan,
    label: "HIGH",
    icon: Flame,
    color: "#e3b341",
    dimColor: "rgba(227,179,65,0.12)",
    borderColor: "rgba(227,179,65,0.25)",
  },
  {
    key: "totalMedium" as keyof Scan,
    label: "MEDIUM",
    icon: AlertTriangle,
    color: "#d29922",
    dimColor: "rgba(210,153,34,0.10)",
    borderColor: "rgba(210,153,34,0.20)",
  },
  {
    key: "totalLow" as keyof Scan,
    label: "LOW",
    icon: ArrowDown,
    color: "#3fb950",
    dimColor: "rgba(63,185,80,0.10)",
    borderColor: "rgba(63,185,80,0.20)",
  },
];

export function SecurityOverviewCard({ scans }: Props) {
  const totals = {
    totalCritical: scans.reduce((s, x) => s + x.totalCritical, 0),
    totalHigh:     scans.reduce((s, x) => s + x.totalHigh, 0),
    totalMedium:   scans.reduce((s, x) => s + x.totalMedium, 0),
    totalLow:      scans.reduce((s, x) => s + x.totalLow, 0),
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "#161b22", border: "1px solid #30363d" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-white">Security Overview</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
            Aggregated across all scans
          </p>
        </div>
        <span
          className="text-[11px] font-medium px-2.5 py-1 rounded-full"
          style={{ background: "rgba(63,185,80,0.12)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.25)" }}
        >
          Live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {severities.map(({ key, label, icon: Icon, color, dimColor, borderColor }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ background: dimColor, border: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-3.5 w-3.5" style={{ color }} />
              <span className="text-[11px] font-semibold tracking-widest" style={{ color }}>
                {label}
              </span>
            </div>
            <p
              className="text-3xl font-bold font-mono tabular-nums leading-none"
              style={{ color }}
            >
              {totals[key as keyof typeof totals]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
