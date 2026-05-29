"use client";

import { useEffect, useState } from "react";
import { scansApi } from "@/lib/api";
import { Scan } from "@/types";
import {
  Brain, AlertCircle, Flame, AlertTriangle,
  ArrowRight, ShieldCheck, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { formatDate, scoreColor } from "@/lib/utils";

const SEV_STYLE = {
  CRITICAL: { color: "#f85149", bg: "rgba(248,81,73,0.10)", icon: AlertCircle },
  HIGH:     { color: "#e3b341", bg: "rgba(227,179,65,0.10)", icon: Flame },
  MEDIUM:   { color: "#d29922", bg: "rgba(210,153,34,0.08)", icon: AlertTriangle },
  LOW:      { color: "#3fb950", bg: "rgba(63,185,80,0.08)",  icon: ShieldCheck },
  CLEAN:    { color: "#3fb950", bg: "rgba(63,185,80,0.08)",  icon: ShieldCheck },
};

function topSeverityKey(scan: Scan) {
  if (scan.totalCritical > 0) return "CRITICAL";
  if (scan.totalHigh > 0)     return "HIGH";
  if (scan.totalMedium > 0)   return "MEDIUM";
  if (scan.totalLow > 0)      return "LOW";
  return "CLEAN";
}

export default function AiInsightsPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    scansApi.list(0).then((r) => setScans(r.content)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const completed   = scans.filter((s) => s.status === "COMPLETED");
  const failed      = scans.filter((s) => s.status === "FAILED");
  const inProgress  = scans.filter((s) => s.status === "RUNNING" || s.status === "QUEUED");
  const withIssues  = completed.filter((s) => s.totalCritical + s.totalHigh + s.totalMedium + s.totalLow > 0);
  const clean       = completed.filter((s) => s.totalCritical + s.totalHigh + s.totalMedium + s.totalLow === 0);
  const totalCritical = completed.reduce((a, s) => a + s.totalCritical, 0);
  const totalHigh     = completed.reduce((a, s) => a + s.totalHigh, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
        >
          <Brain className="h-4 w-4" style={{ color: "#818cf8" }} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white leading-none">AI Insights</h1>
          <p className="text-[11px] mt-0.5" style={{ color: "#8b949e" }}>
            Risk analysis and prioritized findings across all scans
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#6366f1", borderTopColor: "transparent" }}
          />
        </div>
      ) : scans.length === 0 ? (
        <div
          className="rounded-xl p-16 text-center space-y-3"
          style={{ background: "#161b22", border: "1px solid #30363d" }}
        >
          <Brain className="h-10 w-10 mx-auto" style={{ color: "#484f58" }} />
          <p className="font-medium" style={{ color: "#c9d1d9" }}>No scans yet</p>
          <p className="text-xs" style={{ color: "#6e7681" }}>
            Go to Repositories to add a target and run your first scan.
          </p>
          <Link
            href="/repositories"
            className="inline-flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg text-white mt-2"
            style={{ background: "#6366f1" }}
          >
            Add Repository <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Completed",      value: completed.length,  color: "#58a6ff", bg: "rgba(88,166,255,0.10)" },
              { label: "Critical Issues",value: totalCritical,     color: "#f85149", bg: "rgba(248,81,73,0.10)" },
              { label: "High Issues",    value: totalHigh,         color: "#e3b341", bg: "rgba(227,179,65,0.10)" },
              { label: "Clean Scans",    value: clean.length,      color: "#3fb950", bg: "rgba(63,185,80,0.10)" },
            ].map(({ label, value, color, bg }) => (
              <div
                key={label}
                className="rounded-xl p-4"
                style={{ background: "#161b22", border: "1px solid #30363d" }}
              >
                <p className="text-2xl font-bold font-mono tabular-nums" style={{ color }}>{value}</p>
                <p className="text-xs mt-1" style={{ color: "#8b949e" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* In-progress */}
          {inProgress.length > 0 && (
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "rgba(88,166,255,0.06)", border: "1px solid rgba(88,166,255,0.2)" }}
            >
              <div
                className="h-2 w-2 rounded-full animate-pulse shrink-0"
                style={{ background: "#58a6ff" }}
              />
              <p className="text-sm" style={{ color: "#58a6ff" }}>
                {inProgress.length} scan{inProgress.length > 1 ? "s" : ""} currently in progress
              </p>
            </div>
          )}

          {/* All completed scans */}
          {completed.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: "#161b22", border: "1px solid #30363d", color: "#6e7681" }}
            >
              {failed.length > 0
                ? `${failed.length} scan(s) failed. Check Scan Log for errors and retry.`
                : "No completed scans yet. Scans in progress will appear here once finished."}
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "#161b22", border: "1px solid #30363d" }}
            >
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #30363d" }}>
                <div>
                  <h2 className="text-sm font-semibold text-white">Scan Results</h2>
                  <p className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>
                    {withIssues.length} with findings · {clean.length} clean
                  </p>
                </div>
                <TrendingUp className="h-4 w-4" style={{ color: "#6e7681" }} />
              </div>

              <div className="divide-y" style={{ borderColor: "#21262d" }}>
                {completed.map((scan) => {
                  const name    = scan.repository.githubRepoFullName ?? scan.repository.dockerImage ?? "—";
                  const sevKey  = topSeverityKey(scan);
                  const s       = SEV_STYLE[sevKey as keyof typeof SEV_STYLE];
                  const Icon    = s.icon;
                  const total   = scan.totalCritical + scan.totalHigh + scan.totalMedium + scan.totalLow;

                  return (
                    <Link
                      key={scan.id}
                      href={`/scans/${scan.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 group transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#0d1117")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: s.bg }}
                      >
                        <Icon className="h-4 w-4" style={{ color: s.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#6e7681" }}>
                          {formatDate(scan.completedAt)}
                          {scan.branch && ` · ${scan.branch}`}
                        </p>
                      </div>

                      {/* Score */}
                      {scan.securityScore !== null && (
                        <span className={`text-sm font-bold font-mono shrink-0 ${scoreColor(scan.securityScore)}`}>
                          {scan.securityScore}/100
                        </span>
                      )}

                      {/* Findings */}
                      <div className="flex items-center gap-2 shrink-0 min-w-[80px] justify-end">
                        {total === 0 ? (
                          <span className="text-xs" style={{ color: "#3fb950" }}>Clean</span>
                        ) : (
                          <>
                            {scan.totalCritical > 0 && (
                              <span className="text-xs font-semibold" style={{ color: "#f85149" }}>{scan.totalCritical}C</span>
                            )}
                            {scan.totalHigh > 0 && (
                              <span className="text-xs font-semibold" style={{ color: "#e3b341" }}>{scan.totalHigh}H</span>
                            )}
                            {scan.totalMedium > 0 && (
                              <span className="text-xs font-semibold" style={{ color: "#d29922" }}>{scan.totalMedium}M</span>
                            )}
                            {scan.totalLow > 0 && (
                              <span className="text-xs font-semibold" style={{ color: "#3fb950" }}>{scan.totalLow}L</span>
                            )}
                          </>
                        )}
                      </div>

                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "#6e7681" }} />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Failed scans callout */}
          {failed.length > 0 && (
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "rgba(248,81,73,0.06)", border: "1px solid rgba(248,81,73,0.2)" }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#f85149" }} />
              <p className="text-sm" style={{ color: "#f85149" }}>
                {failed.length} scan{failed.length > 1 ? "s" : ""} failed.{" "}
                <Link href="/scans" className="underline underline-offset-2">View details</Link>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
