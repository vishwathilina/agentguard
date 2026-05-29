"use client";

import { Brain, AlertCircle, Flame, AlertTriangle, ArrowRight } from "lucide-react";
import { Scan } from "@/types";
import Link from "next/link";

interface Props { scans: Scan[] }

function SeverityIcon({ level }: { level: "CRITICAL" | "HIGH" | "MEDIUM" }) {
  if (level === "CRITICAL") return <AlertCircle className="h-3 w-3 shrink-0" style={{ color: "#f85149" }} />;
  if (level === "HIGH")     return <Flame        className="h-3 w-3 shrink-0" style={{ color: "#e3b341" }} />;
  return                           <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: "#d29922" }} />;
}

const SEVERITY_BADGE: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: "#f85149", bg: "rgba(248,81,73,0.12)" },
  HIGH:     { color: "#e3b341", bg: "rgba(227,179,65,0.12)" },
  MEDIUM:   { color: "#d29922", bg: "rgba(210,153,34,0.10)" },
};

export function AiInsightsCard({ scans }: Props) {
  const topScans = scans
    .filter((s) => s.status === "COMPLETED" && (s.totalCritical + s.totalHigh) > 0)
    .slice(0, 4);

  const insights: { severity: "CRITICAL" | "HIGH" | "MEDIUM"; text: string; scanId: string }[] = [];

  for (const scan of topScans) {
    const name = scan.repository.githubRepoFullName ?? scan.repository.dockerImage ?? "target";
    if (scan.totalCritical > 0) {
      insights.push({
        severity: "CRITICAL",
        text: `${name} — ${scan.totalCritical} critical finding${scan.totalCritical > 1 ? "s" : ""} detected.`,
        scanId: scan.id,
      });
    } else if (scan.totalHigh > 0) {
      insights.push({
        severity: "HIGH",
        text: `${name} — ${scan.totalHigh} high-severity issue${scan.totalHigh > 1 ? "s" : ""} found.`,
        scanId: scan.id,
      });
    }
    if (insights.length >= 3) break;
  }

  if (insights.length === 0) {
    insights.push({
      severity: "MEDIUM",
      text: "No high-severity findings across recent scans. System is in a healthy state.",
      scanId: "",
    });
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
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
          >
            <Brain className="h-4 w-4" style={{ color: "#818cf8" }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Agent Insights</h3>
            <p className="text-[10px]" style={{ color: "#8b949e" }}>Prioritized findings</p>
          </div>
        </div>
        <Link href="/scans" className="transition-colors hover:text-white" style={{ color: "#6e7681" }}>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Insights */}
      <div className="space-y-3 flex-1">
        {insights.map((item, i) => {
          const badge = SEVERITY_BADGE[item.severity];
          const content = (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-lg p-3"
              style={{ background: "#0d1117", border: "1px solid #21262d" }}
            >
              <SeverityIcon level={item.severity} />
              <div className="flex-1 min-w-0">
                <span
                  className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded mb-1"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {item.severity}
                </span>
                <p className="text-xs leading-relaxed" style={{ color: "#c9d1d9" }}>
                  {item.text}
                </p>
              </div>
            </div>
          );

          return item.scanId ? (
            <Link key={i} href={`/scans/${item.scanId}`} className="block hover:opacity-80 transition-opacity">
              {content}
            </Link>
          ) : content;
        })}
      </div>
    </div>
  );
}
