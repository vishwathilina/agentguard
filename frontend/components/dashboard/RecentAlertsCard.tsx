"use client";

import { Scan } from "@/types";
import Link from "next/link";
import { CoolIcon, type CoolIconName, type IconTone } from "@/components/icons/CoolIcon";

interface Props { scans: Scan[] }

type AlertItem = {
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  text: string;
  sub: string;
  scanId: string;
  timeAgo: string;
};

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

const SEVERITY_META: Record<
  string,
  { color: string; bg: string; icon: CoolIconName; tone: IconTone }
> = {
  CRITICAL: {
    color: "var(--ag-danger)",
    bg: "color-mix(in srgb, var(--ag-danger) 12%, transparent)",
    icon: "warning",
    tone: "danger",
  },
  HIGH: {
    color: "var(--ag-warning)",
    bg: "color-mix(in srgb, var(--ag-warning) 12%, transparent)",
    icon: "shield-warning",
    tone: "warning",
  },
  MEDIUM: {
    color: "var(--ag-orange)",
    bg: "color-mix(in srgb, var(--ag-orange) 10%, transparent)",
    icon: "warning",
    tone: "coral",
  },
};

export function RecentAlertsCard({ scans }: Props) {
  const alerts: AlertItem[] = [];

  for (const scan of scans) {
    if (alerts.length >= 3) break;
    const name = scan.repository.githubRepoFullName ?? scan.repository.dockerImage ?? "target";
    if (scan.totalCritical > 0) {
      alerts.push({
        severity: "CRITICAL",
        text: `${scan.totalCritical} critical vulnerabilit${scan.totalCritical > 1 ? "ies" : "y"} in ${name}`,
        sub: `Scan completed — ${scan.totalCritical + scan.totalHigh + scan.totalMedium + scan.totalLow} total findings`,
        scanId: scan.id,
        timeAgo: timeAgo(scan.completedAt),
      });
    } else if (scan.totalHigh > 0) {
      alerts.push({
        severity: "HIGH",
        text: `${scan.totalHigh} high-severity issue${scan.totalHigh > 1 ? "s" : ""} in ${name}`,
        sub: `${scan.totalHigh + scan.totalMedium + scan.totalLow} total findings`,
        scanId: scan.id,
        timeAgo: timeAgo(scan.completedAt),
      });
    }
  }

  return (
    <div className="ag-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CoolIcon name="bell" tone="warning" size={18} />
          <h2 className="ag-text-section">Recent alerts</h2>
        </div>
        <Link
          href="/alerts"
          className="ag-text-link transition-opacity hover:opacity-80"
        >
          View all
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <CoolIcon name="shield-check" tone="safe" size={28} />
          <p className="ag-text-body">No critical alerts</p>
        </div>
      ) : (
        <ul className="space-y-3 flex-1">
          {alerts.map((a) => {
            const meta = SEVERITY_META[a.severity];
            return (
              <li key={a.scanId}>
                <Link
                  href={`/scans/${a.scanId}`}
                  className="block rounded-lg p-3 transition-colors hover:bg-white/[0.03]"
                  style={{ background: meta.bg, border: `1px solid color-mix(in srgb, ${meta.color} 22%, transparent)` }}
                >
                  <div className="flex items-start gap-2.5">
                    <CoolIcon name={meta.icon} tone={meta.tone} size={16} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="ag-text-title font-medium leading-snug">{a.text}</p>
                      <p className="ag-text-meta mt-1">{a.sub}</p>
                      <p className="ag-text-meta mt-1" style={{ color: meta.color }}>
                        {a.timeAgo}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
