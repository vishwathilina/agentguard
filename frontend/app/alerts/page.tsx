"use client";

import { useEffect, useState } from "react";
import { scansApi } from "@/lib/api";
import { Scan } from "@/types";
import { Bell, AlertCircle, Flame, AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return "just now";
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

type AlertItem = {
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  title: string;
  detail: string;
  scanId: string;
  repoName: string;
  time: string;
};

const SEVERITY_STYLE = {
  CRITICAL: { color: "#f85149", bg: "rgba(248,81,73,0.10)", border: "rgba(248,81,73,0.25)", icon: AlertCircle },
  HIGH:     { color: "#e3b341", bg: "rgba(227,179,65,0.10)", border: "rgba(227,179,65,0.25)", icon: Flame },
  MEDIUM:   { color: "#d29922", bg: "rgba(210,153,34,0.08)", border: "rgba(210,153,34,0.20)", icon: AlertTriangle },
};

export default function AlertsPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    scansApi.list(0).then((r) => setScans(r.content)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const alerts: AlertItem[] = [];
  for (const scan of scans) {
    if (scan.status !== "COMPLETED") continue;
    const name = scan.repository.githubRepoFullName ?? scan.repository.dockerImage ?? "target";
    if (scan.totalCritical > 0) {
      alerts.push({
        severity: "CRITICAL",
        title: `${scan.totalCritical} critical vulnerabilit${scan.totalCritical > 1 ? "ies" : "y"} detected`,
        detail: `${name} — ${scan.totalCritical + scan.totalHigh + scan.totalMedium + scan.totalLow} total findings`,
        scanId: scan.id,
        repoName: name,
        time: timeAgo(scan.completedAt),
      });
    }
    if (scan.totalHigh > 0) {
      alerts.push({
        severity: "HIGH",
        title: `${scan.totalHigh} high-severity issue${scan.totalHigh > 1 ? "s" : ""} found`,
        detail: `${name} — review and remediate`,
        scanId: scan.id,
        repoName: name,
        time: timeAgo(scan.completedAt),
      });
    }
    if (scan.totalMedium > 3) {
      alerts.push({
        severity: "MEDIUM",
        title: `${scan.totalMedium} medium-severity findings`,
        detail: `${name} — consider scheduling remediation`,
        scanId: scan.id,
        repoName: name,
        time: timeAgo(scan.completedAt),
      });
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          <Bell className="h-4 w-4" style={{ color: "#f87171" }} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white leading-none">Alerts</h1>
          <p className="text-[11px] mt-0.5" style={{ color: "#8b949e" }}>
            Security notifications from completed scans
          </p>
        </div>
        {alerts.length > 0 && (
          <span
            className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(248,81,73,0.12)", color: "#f85149", border: "1px solid rgba(248,81,73,0.25)" }}
          >
            {alerts.length} active
          </span>
        )}
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#6366f1", borderTopColor: "transparent" }}
          />
        </div>
      ) : alerts.length === 0 ? (
        <div
          className="rounded-xl p-16 text-center space-y-3"
          style={{ background: "#161b22", border: "1px solid #30363d" }}
        >
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto"
            style={{ background: "rgba(63,185,80,0.12)", border: "1px solid rgba(63,185,80,0.25)" }}
          >
            <Bell className="h-6 w-6" style={{ color: "#3fb950" }} />
          </div>
          <p className="font-medium" style={{ color: "#c9d1d9" }}>No active alerts</p>
          <p className="text-xs" style={{ color: "#6e7681" }}>
            All scanned targets are clean or no scans have been completed yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => {
            const s = SEVERITY_STYLE[alert.severity];
            const Icon = s.icon;
            return (
              <Link
                key={i}
                href={`/scans/${alert.scanId}`}
                className="block group"
              >
                <div
                  className="rounded-xl p-4 flex items-start gap-4 transition-opacity group-hover:opacity-80"
                  style={{ background: "#161b22", border: "1px solid #30363d" }}
                >
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: s.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-sm font-medium text-white">{alert.title}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#8b949e" }}>{alert.detail}</p>
                    <p className="text-[10px] mt-1" style={{ color: "#6e7681" }}>
                      {alert.repoName} · {alert.time}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#6e7681" }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
