"use client";

import { useEffect, useState } from "react";
import { scansApi } from "@/lib/api";
import { Scan } from "@/types";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoolIcon, type CoolIconName, type IconTone } from "@/components/icons/CoolIcon";

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
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

const SEVERITY_META: Record<
  string,
  { color: string; bg: string; border: string; icon: CoolIconName; tone: IconTone }
> = {
  CRITICAL: {
    color: "var(--ag-danger)",
    bg: "color-mix(in srgb, var(--ag-danger) 10%, transparent)",
    border: "color-mix(in srgb, var(--ag-danger) 25%, transparent)",
    icon: "warning",
    tone: "danger",
  },
  HIGH: {
    color: "var(--ag-warning)",
    bg: "color-mix(in srgb, var(--ag-warning) 10%, transparent)",
    border: "color-mix(in srgb, var(--ag-warning) 25%, transparent)",
    icon: "shield-warning",
    tone: "warning",
  },
  MEDIUM: {
    color: "var(--ag-orange)",
    bg: "color-mix(in srgb, var(--ag-orange) 8%, transparent)",
    border: "color-mix(in srgb, var(--ag-orange) 20%, transparent)",
    icon: "warning",
    tone: "coral",
  },
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
      <PageHeader
        icon="bell"
        tone="warning"
        title="Alerts"
        subtitle="Security notifications from completed scans"
        trailing={
          alerts.length > 0 ? (
            <span
              className="ml-2 font-semibold px-2.5 py-1 rounded-full shrink-0"
              style={{
                fontSize: "var(--ag-text-label)",
                background: "color-mix(in srgb, var(--ag-danger) 12%, transparent)",
                color: "var(--ag-danger)",
                border: "1px solid color-mix(in srgb, var(--ag-danger) 28%, transparent)",
              }}
            >
              {alerts.length} active
            </span>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 animate-spin ag-spinner" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="ag-card p-16 text-center space-y-3">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto"
            style={{
              background: "color-mix(in srgb, var(--ag-safe) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--ag-safe) 28%, transparent)",
            }}
          >
            <CoolIcon name="shield-check" tone="safe" size={24} />
          </div>
          <p className="ag-text-title">No active alerts</p>
          <p className="ag-text-body">
            All scanned targets are clean or no scans have been completed yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => {
            const meta = SEVERITY_META[alert.severity];
            return (
              <Link key={i} href={`/scans/${alert.scanId}`} className="block group">
                <div className="ag-card p-4 flex items-start gap-4 transition-opacity group-hover:opacity-90">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
                  >
                    <CoolIcon name={meta.icon} tone={meta.tone} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="ag-text-label px-1.5 py-0.5 rounded"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {alert.severity}
                      </span>
                      <span className="ag-text-title font-medium">{alert.title}</span>
                    </div>
                    <p className="ag-text-meta mt-1">{alert.detail}</p>
                    <p className="ag-text-meta mt-1">
                      {alert.repoName} · {alert.time}
                    </p>
                  </div>
                  <CoolIcon
                    name="chevron-down"
                    tone="muted"
                    size={16}
                    className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity rotate-[-90deg]"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
