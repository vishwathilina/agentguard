"use client";

import { Scan } from "@/types";
import { scoreColor } from "@/lib/utils";

interface Props {
  scans: Scan[];
}

export function SecurityScoreCard({ scans }: Props) {
  const completed = scans.filter((s) => s.status === "COMPLETED");
  const latest = completed[0];
  const avgScore =
    completed.length > 0
      ? Math.round(
          completed
            .filter((s) => s.securityScore !== null)
            .reduce((sum, s) => sum + (s.securityScore ?? 0), 0) /
            completed.filter((s) => s.securityScore !== null).length
        )
      : null;

  const totalCritical = scans.reduce((s, x) => s + x.totalCritical, 0);
  const totalHigh = scans.reduce((s, x) => s + x.totalHigh, 0);
  const totalMedium = scans.reduce((s, x) => s + x.totalMedium, 0);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Security Score</p>
        <p className={`text-3xl font-bold ${scoreColor(avgScore)}`}>
          {avgScore !== null ? avgScore : "—"}
          {avgScore !== null && <span className="text-base font-normal text-gray-500">/100</span>}
        </p>
      </div>
      <div className="bg-gray-900 border border-red-900/40 rounded-xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Critical</p>
        <p className="text-3xl font-bold text-red-500">{totalCritical}</p>
      </div>
      <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">High</p>
        <p className="text-3xl font-bold text-orange-500">{totalHigh}</p>
      </div>
      <div className="bg-gray-900 border border-yellow-900/40 rounded-xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Medium</p>
        <p className="text-3xl font-bold text-yellow-500">{totalMedium}</p>
      </div>
    </div>
  );
}
