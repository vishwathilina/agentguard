"use client";

import { Container, Layers, GitBranch, FileCode2, ArrowRight } from "lucide-react";
import { Scan } from "@/types";
import Link from "next/link";

interface Props { scans: Scan[] }

export function InfrastructureCard({ scans }: Props) {
  const dockerImages = scans.filter(
    (s) => s.repository.targetType === "DOCKER_IMAGE"
  ).length;

  const k8sClusters = scans.filter((s) =>
    (s.detectedTechStacks ?? []).includes("KUBERNETES")
  ).length;

  const repos = new Set(
    scans
      .filter((s) => s.repository.githubRepoFullName)
      .map((s) => s.repository.githubRepoFullName)
  ).size;

  const terraformFiles = scans.filter((s) =>
    (s.detectedTechStacks ?? []).includes("TERRAFORM")
  ).length;

  const metrics = [
    {
      label: "Docker Images",
      value: dockerImages,
      icon: Container,
      color: "#38bdf8",
      bg: "rgba(56,189,248,0.12)",
    },
    {
      label: "K8s Clusters",
      value: k8sClusters,
      icon: Layers,
      color: "#a78bfa",
      bg: "rgba(167,139,250,0.12)",
    },
    {
      label: "Repositories",
      value: repos,
      icon: GitBranch,
      color: "#fb923c",
      bg: "rgba(251,146,60,0.12)",
    },
    {
      label: "Terraform",
      value: terraformFiles,
      icon: FileCode2,
      color: "#818cf8",
      bg: "rgba(129,140,248,0.12)",
    },
  ];

  return (
    <div className="ag-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="ag-text-section">Infrastructure</h3>
          <p className="ag-text-meta mt-1">Scanned targets by type</p>
        </div>
        <Link href="/repositories" className="transition-opacity hover:opacity-80" style={{ color: "var(--ag-cyan)" }}>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-lg p-3 flex items-center gap-3"
            style={{ background: "var(--ag-bg)", border: "1px solid var(--ag-border)" }}
          >
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: bg }}
            >
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="ag-text-metric-lg leading-none" style={{ color, fontSize: "1.5rem" }}>
                {value}
              </p>
              <p className="ag-text-meta mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
