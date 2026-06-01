"use client";

import Link from "next/link";
import { Scan } from "@/types";
import { formatDate } from "@/lib/utils";
import { Container, GitBranch, Layers, ArrowRight } from "lucide-react";

const TARGET_TYPE_ICON: Record<string, { icon: typeof Container; label: string }> = {
  DOCKER_IMAGE: { icon: Container, label: "Docker Image" },
  GIT_REPO:     { icon: GitBranch, label: "Repository" },
  K8S_CLUSTER:  { icon: Layers,    label: "K8s Cluster" },
};

const STATUS_STYLE: Record<string, { color: string; bg: string; dot: string }> = {
  COMPLETED: { color: "#3fb950", bg: "rgba(63,185,80,0.12)",   dot: "#3fb950" },
  RUNNING:   { color: "#58a6ff", bg: "rgba(88,166,255,0.12)",  dot: "#58a6ff" },
  QUEUED:    { color: "#8b949e", bg: "rgba(139,148,158,0.10)", dot: "#8b949e" },
  FAILED:    { color: "#f85149", bg: "rgba(248,81,73,0.12)",   dot: "#f85149" },
  CANCELLED: { color: "#6e7681", bg: "rgba(110,118,129,0.10)", dot: "#6e7681" },
};

interface Props { scans: Scan[] }

export function RecentScansTable({ scans }: Props) {
  return (
    <div className="ag-card overflow-hidden p-0">
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--ag-border)" }}
      >
        <div>
          <h3 className="ag-text-section">Projects</h3>
          <p className="ag-text-meta mt-1">Recent scan history</p>
        </div>
        <Link href="/scans" className="ag-text-link flex items-center gap-1 transition-opacity hover:opacity-80">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {scans.length === 0 ? (
        <div className="p-10 text-center ag-text-body">
          No scans yet. Go to Repositories to start your first scan.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--ag-border)" }}>
              {["Time", "Target Type", "Name", "Status", "Findings"].map((h) => (
                <th key={h} className="px-5 py-3 text-left ag-text-label">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => {
              const name = scan.repository.githubRepoFullName ?? scan.repository.dockerImage ?? "—";
              const tType = scan.repository.targetType ?? "GIT_REPO";
              const typeInfo = TARGET_TYPE_ICON[tType] ?? TARGET_TYPE_ICON.GIT_REPO;
              const TypeIcon = typeInfo.icon;
              const ss = STATUS_STYLE[scan.status] ?? STATUS_STYLE.QUEUED;
              const totalFindings = scan.totalCritical + scan.totalHigh + scan.totalMedium + scan.totalLow;

              return (
                <tr
                  key={scan.id}
                  style={{ borderBottom: "1px solid var(--ag-border)" }}
                  className="transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ag-bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Time */}
                  <td className="px-5 py-3 ag-text-meta whitespace-nowrap">
                    {formatDate(scan.startedAt)}
                  </td>

                  {/* Target Type */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "#6e7681" }} />
                      <span className="ag-text-meta">{typeInfo.label}</span>
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-5 py-3">
                    <Link
                      href={`/scans/${scan.id}`}
                      className="ag-text-title font-medium transition-colors hover:opacity-90 block truncate max-w-[180px]"
                      style={{ color: "var(--ag-cyan)" }}
                    >
                      {name}
                    </Link>
                    {scan.branch && (
                      <span className="ag-text-meta">
                        {scan.branch}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: ss.dot }}
                      />
                      <span
                        className="ag-text-meta font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: ss.bg, color: ss.color }}
                      >
                        {scan.status === "COMPLETED" ? "Compliant" : scan.status === "FAILED" ? "Findings" : scan.status}
                      </span>
                    </div>
                  </td>

                  {/* Findings */}
                  <td className="px-5 py-3">
                    {totalFindings === 0 ? (
                      <span className="ag-text-meta font-semibold" style={{ color: "var(--ag-safe)" }}>0</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {scan.totalCritical > 0 && (
                          <span className="ag-text-meta font-semibold" style={{ color: "var(--ag-danger)" }}>
                            {scan.totalCritical}C
                          </span>
                        )}
                        {scan.totalHigh > 0 && (
                          <span className="ag-text-meta font-semibold" style={{ color: "var(--ag-warning)" }}>
                            {scan.totalHigh}H
                          </span>
                        )}
                        {scan.totalMedium > 0 && (
                          <span className="ag-text-meta font-semibold" style={{ color: "var(--ag-orange)" }}>
                            {scan.totalMedium}M
                          </span>
                        )}
                        <span className="ag-text-meta">
                          ({totalFindings})
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
