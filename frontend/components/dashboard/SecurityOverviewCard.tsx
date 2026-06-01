"use client";

import { Scan } from "@/types";
import { CoolIcon, type CoolIconName, type IconTone } from "@/components/icons/CoolIcon";

interface Props { scans: Scan[] }

const severities: {
  key: keyof Scan;
  label: string;
  icon: CoolIconName;
  tone: IconTone;
  color: string;
  dimColor: string;
  borderColor: string;
}[] = [
  {
    key: "totalCritical",
    label: "CRITICAL",
    icon: "warning",
    tone: "danger",
    color: "var(--ag-danger)",
    dimColor: "color-mix(in srgb, var(--ag-danger) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--ag-danger) 28%, transparent)",
  },
  {
    key: "totalHigh",
    label: "HIGH",
    icon: "shield-warning",
    tone: "warning",
    color: "var(--ag-warning)",
    dimColor: "color-mix(in srgb, var(--ag-warning) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--ag-warning) 28%, transparent)",
  },
  {
    key: "totalMedium",
    label: "MEDIUM",
    icon: "warning",
    tone: "coral",
    color: "var(--ag-orange)",
    dimColor: "color-mix(in srgb, var(--ag-orange) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--ag-orange) 24%, transparent)",
  },
  {
    key: "totalLow",
    label: "LOW",
    icon: "shield-check",
    tone: "safe",
    color: "var(--ag-safe)",
    dimColor: "color-mix(in srgb, var(--ag-safe) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--ag-safe) 22%, transparent)",
  },
];

export function SecurityOverviewCard({ scans }: Props) {
  const totals = {
    totalCritical: scans.reduce((s, x) => s + x.totalCritical, 0),
    totalHigh:     scans.reduce((s, x) => s + x.totalHigh, 0),
    totalMedium:   scans.reduce((s, x) => s + x.totalMedium, 0),
    totalLow:      scans.reduce((s, x) => s + x.totalLow, 0),
  };

  const completed = scans.filter((s) => s.status === "COMPLETED" && s.securityScore != null);
  const avgScore =
    completed.length > 0
      ? Math.round(
          completed.reduce((sum, s) => sum + (s.securityScore ?? 0), 0) / completed.length
        )
      : null;

  return (
    <div className="ag-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="ag-text-section">Security posture</h2>
          <p className="ag-text-meta mt-1">Aggregated across all scans</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {avgScore !== null && (
            <div className="flex items-baseline gap-1">
              <span className="ag-text-metric-xl" style={{ color: "var(--ag-cyan)" }}>
                {avgScore}
              </span>
              <span className="ag-text-metric-denom">/100</span>
            </div>
          )}
        <span
          className="font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5"
          style={{
            fontSize: "var(--ag-text-label)",
            background: "color-mix(in srgb, var(--ag-safe) 12%, transparent)",
            color: "var(--ag-safe)",
            border: "1px solid color-mix(in srgb, var(--ag-safe) 28%, transparent)",
            boxShadow: "var(--ag-glow-safe)",
          }}
        >
          <CoolIcon name="shield-check" tone="safe" size={12} />
          Live
        </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {severities.map(({ key, label, icon, tone, color, dimColor, borderColor }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ background: dimColor, border: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <CoolIcon name={icon} tone={tone} size={15} />
              <span className="ag-text-label" style={{ color }}>
                {label}
              </span>
            </div>
            <p className="ag-text-metric-lg">{totals[key as keyof typeof totals]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
