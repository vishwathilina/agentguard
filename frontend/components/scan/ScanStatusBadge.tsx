"use client";

import { ScanStatus } from "@/types";

const STYLE: Record<ScanStatus, { color: string; bg: string; border: string }> = {
  COMPLETED: { color: "#3fb950", bg: "rgba(63,185,80,0.12)",   border: "rgba(63,185,80,0.3)" },
  RUNNING:   { color: "#58a6ff", bg: "rgba(88,166,255,0.12)",  border: "rgba(88,166,255,0.3)" },
  QUEUED:    { color: "#8b949e", bg: "rgba(139,148,158,0.10)", border: "#30363d" },
  FAILED:    { color: "#f85149", bg: "rgba(248,81,73,0.12)",   border: "rgba(248,81,73,0.3)" },
  CANCELLED: { color: "#6e7681", bg: "rgba(110,118,129,0.10)", border: "#30363d" },
};

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  const s = STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {status === "RUNNING" && (
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
          style={{ background: s.color }}
        />
      )}
      {status}
    </span>
  );
}
