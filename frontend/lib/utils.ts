import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Severity } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function severityColor(severity: Severity): string {
  return {
    CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
    HIGH:     "text-orange-400 bg-orange-500/10 border-orange-500/30",
    MEDIUM:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    LOW:      "text-blue-400 bg-blue-500/10 border-blue-500/30",
    INFO:     "text-gray-400 bg-gray-500/10 border-gray-500/30",
  }[severity] ?? "text-gray-400 bg-gray-500/10 border-gray-500/30";
}

export function severityDot(severity: Severity): string {
  return {
    CRITICAL: "bg-red-400",
    HIGH:     "bg-orange-400",
    MEDIUM:   "bg-yellow-400",
    LOW:      "bg-blue-400",
    INFO:     "bg-gray-400",
  }[severity] ?? "bg-gray-400";
}

export function scoreColor(score: number | null): string {
  if (score === null) return "text-gray-500";
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
