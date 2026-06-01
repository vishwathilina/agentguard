"use client";

import { ScanStatus } from "@/types";

const STYLE: Record<ScanStatus, { color: string; bg: string; border: string }> = {
  COMPLETED: {
    color: "var(--ag-safe)",
    bg: "color-mix(in srgb, var(--ag-safe) 12%, transparent)",
    border: "color-mix(in srgb, var(--ag-safe) 30%, transparent)",
  },
  RUNNING: {
    color: "var(--ag-cyan)",
    bg: "color-mix(in srgb, var(--ag-cyan) 12%, transparent)",
    border: "color-mix(in srgb, var(--ag-cyan) 30%, transparent)",
  },
  QUEUED: {
    color: "var(--ag-neutral)",
    bg: "color-mix(in srgb, var(--ag-neutral) 8%, transparent)",
    border: "var(--ag-border)",
  },
  FAILED: {
    color: "var(--ag-danger)",
    bg: "color-mix(in srgb, var(--ag-danger) 12%, transparent)",
    border: "color-mix(in srgb, var(--ag-danger) 30%, transparent)",
  },
  CANCELLED: {
    color: "var(--ag-text-muted)",
    bg: "color-mix(in srgb, var(--ag-text-muted) 10%, transparent)",
    border: "var(--ag-border)",
  },
};

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  const s = STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ag-text-meta font-semibold"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {status === "RUNNING" && (
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
          style={{ background: s.color, boxShadow: "var(--ag-glow-cyan)" }}
        />
      )}
      {status}
    </span>
  );
}
