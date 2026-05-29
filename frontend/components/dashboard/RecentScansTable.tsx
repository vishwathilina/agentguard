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
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#161b22", border: "1px solid #30363d" }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid #30363d" }}
      >
        <div>
          <h3 className="text-sm font-semibold text-white">Recent Scan History</h3>
          <p className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>All findings</p>
        </div>
        <Link href="/scans"
          className="flex items-center gap-1 text-xs transition-colors hover:text-white"
          style={{ color: "#6e7681" }}
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {scans.length === 0 ? (
        <div className="p-10 text-center text-sm" style={{ color: "#6e7681" }}>
          No scans yet. Go to Repositories to start your first scan.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #21262d" }}>
              {["Time", "Target Type", "Name", "Status", "Findings"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-[11px] font-semibold tracking-wider"
                  style={{ color: "#6e7681" }}
                >
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
                  style={{ borderBottom: "1px solid #21262d" }}
                  className="transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#0d1117")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Time */}
                  <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: "#8b949e" }}>
                    {formatDate(scan.startedAt)}
                  </td>

                  {/* Target Type */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "#6e7681" }} />
                      <span className="text-xs" style={{ color: "#8b949e" }}>{typeInfo.label}</span>
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-5 py-3">
                    <Link
                      href={`/scans/${scan.id}`}
                      className="text-xs font-medium transition-colors hover:text-white block truncate max-w-[180px]"
                      style={{ color: "#58a6ff" }}
                    >
                      {name}
                    </Link>
                    {scan.branch && (
                      <span className="text-[10px]" style={{ color: "#6e7681" }}>
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
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: ss.bg, color: ss.color }}
                      >
                        {scan.status === "COMPLETED" ? "Compliant" : scan.status === "FAILED" ? "Findings" : scan.status}
                      </span>
                    </div>
                  </td>

                  {/* Findings */}
                  <td className="px-5 py-3">
                    {totalFindings === 0 ? (
                      <span className="text-xs font-semibold" style={{ color: "#3fb950" }}>0</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {scan.totalCritical > 0 && (
                          <span className="text-xs font-semibold" style={{ color: "#f85149" }}>
                            {scan.totalCritical}C
                          </span>
                        )}
                        {scan.totalHigh > 0 && (
                          <span className="text-xs font-semibold" style={{ color: "#e3b341" }}>
                            {scan.totalHigh}H
                          </span>
                        )}
                        {scan.totalMedium > 0 && (
                          <span className="text-xs font-semibold" style={{ color: "#d29922" }}>
                            {scan.totalMedium}M
                          </span>
                        )}
                        <span className="text-xs" style={{ color: "#6e7681" }}>
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
