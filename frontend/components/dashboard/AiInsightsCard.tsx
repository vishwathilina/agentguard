"use client";

import { Scan } from "@/types";
import Link from "next/link";
import { CoolIcon, type CoolIconName, type IconTone } from "@/components/icons/CoolIcon";

interface Props { scans: Scan[] }

function SeverityIcon({ level }: { level: "CRITICAL" | "HIGH" | "MEDIUM" }) {
  const meta: Record<string, { icon: CoolIconName; tone: IconTone }> = {
    CRITICAL: { icon: "warning", tone: "danger" },
    HIGH:     { icon: "shield-warning", tone: "warning" },
    MEDIUM:   { icon: "warning", tone: "coral" },
  };
  const m = meta[level];
  return <CoolIcon name={m.icon} tone={m.tone} size={14} className="shrink-0 mt-0.5" />;
}

const SEVERITY_BADGE: Record<string, { color: string; bg: string }> = {
  CRITICAL: {
    color: "var(--ag-danger)",
    bg: "color-mix(in srgb, var(--ag-danger) 12%, transparent)",
  },
  HIGH: {
    color: "var(--ag-warning)",
    bg: "color-mix(in srgb, var(--ag-warning) 12%, transparent)",
  },
  MEDIUM: {
    color: "var(--ag-orange)",
    bg: "color-mix(in srgb, var(--ag-orange) 10%, transparent)",
  },
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
    <div className="ag-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "color-mix(in srgb, var(--ag-cyan) 14%, transparent)",
              border: "1px solid color-mix(in srgb, var(--ag-cyan) 32%, transparent)",
              boxShadow: "var(--ag-glow-cyan)",
            }}
          >
            <CoolIcon name="data" tone="primary" size={18} />
          </div>
          <div>
            <h3 className="ag-text-section">Next best actions</h3>
            <p className="ag-text-meta mt-1">Prioritized findings</p>
          </div>
        </div>
        <Link
          href="/scans"
          className="transition-opacity hover:opacity-80"
          style={{ color: "var(--ag-cyan)" }}
        >
          <CoolIcon name="chevron-down" tone="primary" size={16} className="rotate-[-90deg]" />
        </Link>
      </div>

      <div className="space-y-3 flex-1">
        {insights.map((item, i) => {
          const badge = SEVERITY_BADGE[item.severity];
          const content = (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-lg p-3"
              style={{
                background: "var(--ag-bg)",
                border: "1px solid var(--ag-border)",
              }}
            >
              <SeverityIcon level={item.severity} />
              <div className="flex-1 min-w-0">
                <span
                  className="inline-flex items-center ag-text-label px-1.5 py-0.5 rounded mb-1"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {item.severity}
                </span>
                <p className="ag-text-title font-normal leading-relaxed">
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
