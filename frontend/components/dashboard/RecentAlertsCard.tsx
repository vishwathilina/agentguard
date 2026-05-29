"use client";

import { Bell, AlertCircle, Flame, AlertTriangle, ArrowRight } from "lucide-react";
import { Scan } from "@/types";
import Link from "next/link";

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

const SEVERITY_STYLES: Record<string, { color: string; bg: string; icon: typeof AlertCircle }> = {
  CRITICAL: { color: "#f85149", bg: "rgba(248,81,73,0.12)", icon: AlertCircle },
  HIGH:     { color: "#e3b341", bg: "rgba(227,179,65,0.12)", icon: Flame },
  MEDIUM:   { color: "#d29922", bg: "rgba(210,153,34,0.10)", icon: AlertTriangle },
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
    <div
      className="rounded-xl p-5 flex flex-col"
      style={{ background: "#161b22", border: "1px solid #30363d" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <Bell className="h-4 w-4" style={{ color: "#f87171" }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Alerts</h3>
            <p className="text-[10px]" style={{ color: "#8b949e" }}>Security notifications</p>
          </div>
        </div>
        <Link href="/alerts" className="transition-colors hover:text-white" style={{ color: "#6e7681" }}>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div
          className="flex-1 flex items-center justify-center py-6 rounded-lg"
          style={{ background: "#0d1117", border: "1px solid #21262d" }}
        >
          <p className="text-xs" style={{ color: "#6e7681" }}>No active alerts — all clear</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => {
            const style = SEVERITY_STYLES[alert.severity];
            const Icon = style.icon;
            return (
              <Link key={i} href={`/scans/${alert.scanId}`} className="block group">
                <div
                  className="flex gap-3 rounded-lg p-3 transition-opacity group-hover:opacity-80"
                  style={{ background: "#0d1117", border: "1px solid #21262d" }}
                >
                  <div
                    className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: style.bg }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: style.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="text-xs font-medium leading-tight"
                        style={{ color: "#c9d1d9" }}
                      >
                        <span
                          className="inline mr-1 text-[10px] font-bold"
                          style={{ color: style.color }}
                        >
                          [{alert.severity}]
                        </span>
                        {alert.text}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px]" style={{ color: "#6e7681" }}>
                        {alert.sub}
                      </p>
                      <p className="text-[10px] shrink-0 ml-2" style={{ color: "#6e7681" }}>
                        {alert.timeAgo}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
