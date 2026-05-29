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
    <div
      className="rounded-xl p-5"
      style={{ background: "#161b22", border: "1px solid #30363d" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Infrastructure</h3>
          <p className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>
            Scanned targets by type
          </p>
        </div>
        <Link href="/repositories" className="transition-colors hover:text-white" style={{ color: "#6e7681" }}>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-lg p-3 flex items-center gap-3"
            style={{ background: "#0d1117", border: "1px solid #21262d" }}
          >
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: bg }}
            >
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p
                className="text-xl font-bold font-mono tabular-nums leading-none"
                style={{ color }}
              >
                {value}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
