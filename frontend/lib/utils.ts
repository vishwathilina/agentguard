import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Severity } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function severityColor(severity: Severity): string {
  return {
    CRITICAL: "text-[var(--ag-danger)] bg-[color-mix(in_srgb,var(--ag-danger)_12%,transparent)] border-[color-mix(in_srgb,var(--ag-danger)_30%,transparent)]",
    HIGH:     "text-[var(--ag-warning)] bg-[color-mix(in_srgb,var(--ag-warning)_12%,transparent)] border-[color-mix(in_srgb,var(--ag-warning)_30%,transparent)]",
    MEDIUM:   "text-[var(--ag-orange)] bg-[color-mix(in_srgb,var(--ag-orange)_12%,transparent)] border-[color-mix(in_srgb,var(--ag-orange)_28%,transparent)]",
    LOW:      "text-[var(--ag-safe)] bg-[color-mix(in_srgb,var(--ag-safe)_10%,transparent)] border-[color-mix(in_srgb,var(--ag-safe)_25%,transparent)]",
    INFO:     "text-[var(--ag-neutral)] bg-[color-mix(in_srgb,var(--ag-neutral)_8%,transparent)] border-[color-mix(in_srgb,var(--ag-neutral)_22%,transparent)]",
  }[severity] ?? "text-[var(--ag-neutral)] bg-[color-mix(in_srgb,var(--ag-neutral)_8%,transparent)] border-[color-mix(in_srgb,var(--ag-neutral)_22%,transparent)]";
}

export function severityDot(severity: Severity): string {
  return {
    CRITICAL: "bg-[var(--ag-danger)]",
    HIGH:     "bg-[var(--ag-warning)]",
    MEDIUM:   "bg-[var(--ag-orange)]",
    LOW:      "bg-[var(--ag-safe)]",
    INFO:     "bg-[var(--ag-neutral)]",
  }[severity] ?? "bg-[var(--ag-neutral)]";
}

export function scoreColor(score: number | null): string {
  if (score === null) return "text-[var(--ag-text-muted)]";
  if (score >= 80) return "text-[var(--ag-safe)]";
  if (score >= 60) return "text-[var(--ag-lime)]";
  if (score >= 40) return "text-[var(--ag-warning)]";
  return "text-[var(--ag-danger)]";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
