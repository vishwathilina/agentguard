"use client";

import { useEffect, useState } from "react";
import { scansApi } from "@/lib/api";
import { Scan } from "@/types";
import Link from "next/link";
import { formatDate, scoreColor } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoolIcon, type CoolIconName, type IconTone } from "@/components/icons/CoolIcon";

const SEV_META: Record<
  string,
  { color: string; bg: string; icon: CoolIconName; tone: IconTone }
> = {
  CRITICAL: {
    color: "var(--ag-danger)",
    bg: "color-mix(in srgb, var(--ag-danger) 10%, transparent)",
    icon: "warning",
    tone: "danger",
  },
  HIGH: {
    color: "var(--ag-warning)",
    bg: "color-mix(in srgb, var(--ag-warning) 10%, transparent)",
    icon: "shield-warning",
    tone: "warning",
  },
  MEDIUM: {
    color: "var(--ag-orange)",
    bg: "color-mix(in srgb, var(--ag-orange) 8%, transparent)",
    icon: "warning",
    tone: "coral",
  },
  LOW: {
    color: "var(--ag-safe)",
    bg: "color-mix(in srgb, var(--ag-safe) 8%, transparent)",
    icon: "shield-check",
    tone: "safe",
  },
  CLEAN: {
    color: "var(--ag-safe)",
    bg: "color-mix(in srgb, var(--ag-safe) 8%, transparent)",
    icon: "shield-check",
    tone: "safe",
  },
};

function topSeverityKey(scan: Scan) {
  if (scan.totalCritical > 0) return "CRITICAL";
  if (scan.totalHigh > 0) return "HIGH";
  if (scan.totalMedium > 0) return "MEDIUM";
  if (scan.totalLow > 0) return "LOW";
  return "CLEAN";
}

export default function AiInsightsPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    scansApi.list(0).then((r) => setScans(r.content)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const completed = scans.filter((s) => s.status === "COMPLETED");
  const failed = scans.filter((s) => s.status === "FAILED");
  const inProgress = scans.filter((s) => s.status === "RUNNING" || s.status === "QUEUED");
  const withIssues = completed.filter((s) => s.totalCritical + s.totalHigh + s.totalMedium + s.totalLow > 0);
  const clean = completed.filter((s) => s.totalCritical + s.totalHigh + s.totalMedium + s.totalLow === 0);
  const totalCritical = completed.reduce((a, s) => a + s.totalCritical, 0);
  const totalHigh = completed.reduce((a, s) => a + s.totalHigh, 0);

  const stats = [
    { label: "Completed", value: completed.length, color: "var(--ag-cyan)" },
    { label: "Critical issues", value: totalCritical, color: "var(--ag-danger)" },
    { label: "High issues", value: totalHigh, color: "var(--ag-warning)" },
    { label: "Clean scans", value: clean.length, color: "var(--ag-safe)" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        icon="data"
        tone="primary"
        title="Intelligence"
        subtitle="Risk analysis and prioritized findings across all scans"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 animate-spin ag-spinner" />
        </div>
      ) : scans.length === 0 ? (
        <div className="ag-card p-16 text-center space-y-3">
          <CoolIcon name="data" tone="muted" size={40} className="mx-auto opacity-40" />
          <p className="ag-text-title">No scans yet</p>
          <p className="ag-text-body">
            Go to Infrastructure to add a target and run your first scan.
          </p>
          <Link href="/repositories" className="ag-btn-primary inline-flex mt-2">
            Add target
            <CoolIcon name="chevron-down" tone="default" size={14} className="rotate-[-90deg] !text-[#0a0c10]" />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(({ label, value, color }) => (
              <div key={label} className="ag-stat-card">
                <p className="ag-text-metric-lg" style={{ color }}>{value}</p>
                <p className="ag-text-meta mt-1">{label}</p>
              </div>
            ))}
          </div>

          {inProgress.length > 0 && (
            <div
              className="ag-card px-4 py-3 flex items-center gap-3"
              style={{
                background: "color-mix(in srgb, var(--ag-cyan) 6%, transparent)",
                borderColor: "color-mix(in srgb, var(--ag-cyan) 25%, transparent)",
              }}
            >
              <span
                className="h-2 w-2 rounded-full animate-pulse shrink-0"
                style={{ background: "var(--ag-cyan)" }}
              />
              <p className="ag-text-nav" style={{ color: "var(--ag-cyan)" }}>
                {inProgress.length} scan{inProgress.length > 1 ? "s" : ""} in progress
              </p>
            </div>
          )}

          {completed.length === 0 ? (
            <div className="ag-card p-8 text-center ag-text-body">
              {failed.length > 0
                ? `${failed.length} scan(s) failed. Check findings for errors and retry.`
                : "No completed scans yet."}
            </div>
          ) : (
            <div className="ag-card overflow-hidden p-0">
              <div
                className="px-5 py-4 flex items-center justify-between border-b ag-divider"
              >
                <div>
                  <h2 className="ag-text-section">Scan results</h2>
                  <p className="ag-text-meta mt-1">
                    {withIssues.length} with findings · {clean.length} clean
                  </p>
                </div>
                <CoolIcon name="trending-up" tone="muted" size={18} />
              </div>

              <div className="divide-y ag-divider">
                {completed.map((scan) => {
                  const name = scan.repository.githubRepoFullName ?? scan.repository.dockerImage ?? "—";
                  const sevKey = topSeverityKey(scan);
                  const meta = SEV_META[sevKey];
                  const total =
                    scan.totalCritical + scan.totalHigh + scan.totalMedium + scan.totalLow;

                  return (
                    <Link
                      key={scan.id}
                      href={`/scans/${scan.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 group transition-colors hover:bg-[var(--ag-bg)]"
                    >
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: meta.bg }}
                      >
                        <CoolIcon name={meta.icon} tone={meta.tone} size={16} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="ag-text-title truncate">{name}</p>
                        <p className="ag-text-meta mt-0.5">
                          {formatDate(scan.completedAt)}
                          {scan.branch && ` · ${scan.branch}`}
                        </p>
                      </div>

                      {scan.securityScore !== null && (
                        <span className={`ag-text-nav font-bold shrink-0 ${scoreColor(scan.securityScore)}`}>
                          {scan.securityScore}
                          <span className="ag-text-metric-denom font-normal">/100</span>
                        </span>
                      )}

                      <div className="flex items-center gap-2 shrink-0 min-w-[80px] justify-end ag-text-meta font-semibold">
                        {total === 0 ? (
                          <span style={{ color: "var(--ag-safe)" }}>Clean</span>
                        ) : (
                          <>
                            {scan.totalCritical > 0 && (
                              <span style={{ color: "var(--ag-danger)" }}>{scan.totalCritical}C</span>
                            )}
                            {scan.totalHigh > 0 && (
                              <span style={{ color: "var(--ag-warning)" }}>{scan.totalHigh}H</span>
                            )}
                            {scan.totalMedium > 0 && (
                              <span style={{ color: "var(--ag-orange)" }}>{scan.totalMedium}M</span>
                            )}
                            {scan.totalLow > 0 && (
                              <span style={{ color: "var(--ag-safe)" }}>{scan.totalLow}L</span>
                            )}
                          </>
                        )}
                      </div>

                      <CoolIcon
                        name="chevron-down"
                        tone="muted"
                        size={16}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rotate-[-90deg] shrink-0"
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div
              className="ag-card px-4 py-3 flex items-center gap-3"
              style={{
                background: "color-mix(in srgb, var(--ag-danger) 6%, transparent)",
                borderColor: "color-mix(in srgb, var(--ag-danger) 22%, transparent)",
              }}
            >
              <CoolIcon name="warning" tone="danger" size={16} />
              <p className="ag-text-nav" style={{ color: "var(--ag-danger)" }}>
                {failed.length} scan{failed.length > 1 ? "s" : ""} failed.{" "}
                <Link href="/scans" className="underline underline-offset-2 ag-text-link">
                  View details
                </Link>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
