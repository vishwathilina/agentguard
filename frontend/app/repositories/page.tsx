"use client";

import { useEffect, useState, useMemo } from "react";
import { repositoriesApi, scansApi, githubApi, GitHubRepo } from "@/lib/api";
import { Repository } from "@/types";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoolIcon } from "@/components/icons/CoolIcon";

// ── Tool catalogue ──────────────────────────────────────────────────────────
const TOOL_CATALOGUE = [
  {
    name: "GITLEAKS",
    label: "Gitleaks",
    desc: "Scans git history for leaked secrets & credentials.",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "TRIVY",
    label: "Trivy",
    desc: "Vulnerability scanner for containers, filesystems, and IaC.",
    forTypes: ["GIT_REPO", "DOCKER_IMAGE"],
  },
  {
    name: "NPM_AUDIT",
    label: "npm audit",
    desc: "Audits Node.js dependencies for known vulnerabilities.",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "TFSEC",
    label: "tfsec",
    desc: "Static analysis for Terraform infrastructure-as-code.",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "OWASP_DEP_CHECK",
    label: "OWASP Dep-Check",
    desc: "Checks Java/Maven/Gradle dependencies against CVE database.",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "KUBE_BENCH",
    label: "Kubernetes config",
    desc: "Scans Kubernetes manifests for security misconfigurations (Trivy config).",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "SEMGREP",
    label: "Semgrep",
    desc: "Static analysis (SAST) for security bugs across many languages.",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "CHECKOV",
    label: "Checkov",
    desc: "Policy-as-code scanner for Terraform, Kubernetes, and Docker.",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "HADOLINT",
    label: "Hadolint",
    desc: "Lints Dockerfiles for best practices and common mistakes.",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "BANDIT",
    label: "Bandit",
    desc: "Finds common security issues in Python source code.",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "OSV_SCANNER",
    label: "OSV Scanner",
    desc: "Scans dependency manifests against the OSV vulnerability database.",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "GRYPE",
    label: "Grype",
    desc: "CVE scanner for container images and filesystem dependencies.",
    forTypes: ["GIT_REPO", "DOCKER_IMAGE"],
  },
  {
    name: "DOCKLE",
    label: "Dockle",
    desc: "Container image linter for CIS Docker benchmarks.",
    forTypes: ["DOCKER_IMAGE"],
  },
] as const;

type AddMode = "github" | "url" | "docker" | null;

type ScanModalStep = "detecting" | "select";

interface ScanModal {
  repo: Repository;
  step: ScanModalStep;
  detectedStacks: string[];
  recommendedTools: string[];  // original backend recommendation, immutable
  selectedTools: string[];     // user's current selection
  detectError: string | null;
}

export default function RepositoriesPage() {
  const router = useRouter();
  const [repos, setRepos]             = useState<Repository[]>([]);
  const [loading, setLoading]         = useState(true);
  const [addMode, setAddMode]         = useState<AddMode>(null);
  const [error, setError]             = useState<string | null>(null);

  // GitHub picker state
  const [ghRepos, setGhRepos]         = useState<GitHubRepo[]>([]);
  const [ghLoading, setGhLoading]     = useState(false);
  const [ghError, setGhError]         = useState<string | null>(null);
  const [ghSearch, setGhSearch]       = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [branch, setBranch]           = useState("main");

  // URL add state
  const [repoUrl, setRepoUrl]         = useState("");
  const [urlBranch, setUrlBranch]     = useState("main");
  const [urlError, setUrlError]       = useState<string | null>(null);

  // Docker form state
  const [dockerImage, setDockerImage] = useState("");

  const [saving, setSaving]           = useState(false);
  const [triggering, setTriggering]   = useState<string | null>(null);

  // Scan options modal
  const [scanModal, setScanModal]     = useState<ScanModal | null>(null);

  useEffect(() => {
    repositoriesApi
      .list()
      .then(setRepos)
      .catch((e) => setError(`Failed to load repositories: ${e?.response?.data?.message ?? e.message}`))
      .finally(() => setLoading(false));
  }, []);

  const openGitHub = () => {
    setAddMode("github");
    setGhLoading(true);
    setGhError(null);
    githubApi
      .repos()
      .then(setGhRepos)
      .catch((e) => setGhError(`Could not load GitHub repos: ${e?.response?.status === 401 ? "Not authenticated" : e.message}`))
      .finally(() => setGhLoading(false));
  };

  const filteredGhRepos = useMemo(() => {
    if (!ghSearch) return ghRepos;
    const q = ghSearch.toLowerCase();
    return ghRepos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
    );
  }, [ghRepos, ghSearch]);

  const handleAddGitHub = async () => {
    if (!selectedRepo) return;
    setSaving(true);
    setError(null);
    try {
      const repo = await repositoriesApi.create({
        targetType: "GIT_REPO",
        githubRepoFullName: selectedRepo.fullName,
        defaultBranch: branch || selectedRepo.defaultBranch,
      });
      setRepos((prev) => [repo, ...prev]);
      resetAdd();
    } catch (err: any) {
      setError(`Failed to add repository: ${err?.response?.data?.message ?? err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddDocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dockerImage.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const repo = await repositoriesApi.create({
        targetType: "DOCKER_IMAGE",
        dockerImage: dockerImage.trim(),
      });
      setRepos((prev) => [repo, ...prev]);
      resetAdd();
    } catch (err: any) {
      setError(`Failed to add image: ${err?.response?.data?.message ?? err.message}`);
    } finally {
      setSaving(false);
    }
  };

  /** Parse https://github.com/owner/repo or owner/repo into "owner/repo" */
  function parseGithubUrl(raw: string): string | null {
    const trimmed = raw.trim().replace(/\.git$/, "");
    const urlMatch = trimmed.match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
    if (urlMatch) return urlMatch[1];
    const slugMatch = trimmed.match(/^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)$/);
    if (slugMatch) return slugMatch[1];
    return null;
  }

  const handleAddByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    const fullName = parseGithubUrl(repoUrl);
    if (!fullName) {
      setUrlError("Enter a valid GitHub URL (e.g. https://github.com/owner/repo) or owner/repo slug.");
      return;
    }
    setSaving(true);
    try {
      const repo = await repositoriesApi.create({
        targetType: "GIT_REPO",
        githubRepoFullName: fullName,
        defaultBranch: urlBranch.trim() || "main",
      });
      setRepos((prev) => [repo, ...prev]);
      resetAdd();
    } catch (err: any) {
      setUrlError(`Failed to add repository: ${err?.response?.data?.message ?? err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetAdd = () => {
    setAddMode(null);
    setSelectedRepo(null);
    setGhSearch("");
    setBranch("main");
    setRepoUrl("");
    setUrlBranch("main");
    setUrlError(null);
    setDockerImage("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this target?")) return;
    await repositoriesApi.delete(id);
    setRepos((prev) => prev.filter((r) => r.id !== id));
  };

  const openScanModal = async (repo: Repository) => {
    // Open immediately in "detecting" step
    setScanModal({ repo, step: "detecting", detectedStacks: [], recommendedTools: [], selectedTools: [], detectError: null });

    try {
      const result = await repositoriesApi.detectTech(repo.id);
      setScanModal({
        repo,
        step: "select",
        detectedStacks: result.techStacks,
        recommendedTools: result.recommendedTools,
        selectedTools: result.recommendedTools,
        detectError: null,
      });
    } catch (e: any) {
      const fallback = TOOL_CATALOGUE
        .filter((t) => (t.forTypes as readonly string[]).includes(repo.targetType))
        .map((t) => t.name);
      setScanModal({
        repo,
        step: "select",
        detectedStacks: [],
        recommendedTools: fallback,
        selectedTools: fallback,
        detectError: "Could not auto-detect tech stack. Showing all available tools.",
      });
    }
  };

  const toggleTool = (name: string) => {
    setScanModal((prev) => {
      if (!prev) return prev;
      const has = prev.selectedTools.includes(name);
      return {
        ...prev,
        selectedTools: has
          ? prev.selectedTools.filter((t) => t !== name)
          : [...prev.selectedTools, name],
      };
    });
  };

  const TECH_LABELS: Record<string, string> = {
    NODE_JS:        "Node.js",
    SPRING_BOOT:    "Spring Boot",
    GRADLE_JAVA:    "Gradle/Java",
    DOCKER:         "Docker",
    TERRAFORM:      "Terraform",
    KUBERNETES:     "Kubernetes",
    GITHUB_ACTIONS: "GitHub Actions",
  };

  const handleScan = async () => {
    if (!scanModal) return;
    const { repo, selectedTools } = scanModal;
    setScanModal(null);
    setTriggering(repo.id);
    setError(null);
    try {
      const scan = await scansApi.trigger(repo.id, undefined, selectedTools);
      router.push(`/scans/${scan.id}`);
    } catch (err: any) {
      setError(`Failed to start scan: ${err?.response?.data?.message ?? err.message}`);
      setTriggering(null);
    }
  };

  return (
    <>
    <div className="space-y-5 max-w-4xl mx-auto">
      <PageHeader
        icon="folder"
        tone="primary"
        title="Infrastructure"
        subtitle="Manage repos and Docker images to scan"
      >
        {!addMode && (
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={openGitHub} className="ag-btn-primary">
              <CoolIcon name="code" tone="default" size={14} className="!text-[#0a0c10]" />
              My repos
            </button>
            <button type="button" onClick={() => setAddMode("url")} className="ag-btn-secondary">
              <CoolIcon name="plus" tone="primary" size={14} />
              Add by URL
            </button>
            <button type="button" onClick={() => setAddMode("docker")} className="ag-btn-secondary">
              <CoolIcon name="cloud" tone="primary" size={14} />
              Docker image
            </button>
          </div>
        )}
      </PageHeader>

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 ag-text-nav"
          style={{
            background: "color-mix(in srgb, var(--ag-danger) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--ag-danger) 28%, transparent)",
            color: "var(--ag-danger)",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-4 hover:opacity-80"
            aria-label="Dismiss"
          >
            <CoolIcon name="close" tone="danger" size={16} />
          </button>
        </div>
      )}

      {/* GitHub Repo Picker */}
      {addMode === "github" && (
        <div className="ag-card overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b ag-divider">
            <h2 className="ag-text-section">Select a GitHub repository</h2>
            <button type="button" onClick={resetAdd} className="hover:opacity-80 text-[var(--ag-text-muted)]">
              <CoolIcon name="close" tone="muted" size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b ag-divider">
            <div className="relative">
              <CoolIcon
                name="search"
                tone="muted"
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                autoFocus
                value={ghSearch}
                onChange={(e) => setGhSearch(e.target.value)}
                placeholder="Search repositories..."
                className="w-full rounded-lg pl-9 pr-3 py-2 ag-text-nav text-white outline-none ag-input"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto border-b ag-divider">
            {ghLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 rounded-full border-2 animate-spin ag-spinner" />
              </div>
            ) : ghError ? (
              <p className="text-center ag-text-nav py-10 px-4" style={{ color: "var(--ag-danger)" }}>{ghError}</p>
            ) : filteredGhRepos.length === 0 ? (
              <p className="text-center ag-text-body py-10">No repositories found.</p>
            ) : (
              filteredGhRepos.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setSelectedRepo(r); setBranch(r.defaultBranch); }}
                  className={`w-full text-left px-5 py-3 flex items-start gap-3 transition-colors border-l-2 ${
                    selectedRepo?.id === r.id
                      ? "ag-nav-active"
                      : "border-transparent hover:bg-[var(--ag-bg)]"
                  }`}
                >
                  <CoolIcon name="code" tone="muted" size={16} className="mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="ag-text-title truncate">{r.fullName}</span>
                      {r.isPrivate && <CoolIcon name="lock" tone="muted" size={12} className="shrink-0" />}
                      {r.language && (
                        <span
                          className="ag-text-meta px-1.5 py-0.5 rounded"
                          style={{ background: "var(--ag-bg)" }}
                        >
                          {r.language}
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="ag-text-meta truncate mt-0.5">{r.description}</p>
                    )}
                  </div>
                  <span className="ag-text-meta shrink-0">{r.stargazersCount} ★</span>
                </button>
              ))
            )}
          </div>

          {/* Branch + confirm */}
          {selectedRepo && (
            <div className="px-5 py-4 flex items-center gap-3 border-t ag-divider flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="ag-text-meta mb-1">
                  Selected: <span className="text-[var(--ag-text)]">{selectedRepo.fullName}</span>
                </p>
                <div className="flex items-center gap-2">
                  <CoolIcon name="chevron-down" tone="muted" size={14} />
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="Branch"
                    className="rounded-lg px-2 py-1 ag-text-nav text-white w-32 outline-none ag-input"
                  />
                </div>
              </div>
              <button type="button" onClick={handleAddGitHub} disabled={saving} className="ag-btn-primary">
                {saving ? (
                  <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin border-[#0a0c10]" />
                ) : (
                  <CoolIcon name="plus" tone="default" size={16} className="!text-[#0a0c10]" />
                )}
                Add repository
              </button>
              <button type="button" onClick={resetAdd} className="ag-text-nav text-[var(--ag-text-muted)] hover:text-white">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add by URL Form */}
      {addMode === "url" && (
        <form onSubmit={handleAddByUrl} className="ag-card overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b ag-divider">
            <div className="flex items-center gap-2">
              <CoolIcon name="code" tone="primary" size={18} />
              <h2 className="ag-text-section">Add GitHub repository by URL</h2>
            </div>
            <button type="button" onClick={resetAdd} className="hover:opacity-80">
              <CoolIcon name="close" tone="muted" size={16} />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="ag-text-meta">Repository URL or slug</label>
              <input
                required
                autoFocus
                value={repoUrl}
                onChange={(e) => { setRepoUrl(e.target.value); setUrlError(null); }}
                placeholder="https://github.com/owner/repo  or  owner/repo"
                className="w-full rounded-lg px-3 py-2 ag-text-nav text-white outline-none font-mono placeholder:font-sans ag-input"
                style={urlError ? { borderColor: "var(--ag-danger)" } : undefined}
              />
              {urlError && (
                <p className="ag-text-body" style={{ color: "var(--ag-danger)" }}>{urlError}</p>
              )}
              <p className="ag-text-body">
                Supports public and private repos you have access to.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="ag-text-meta">Branch</label>
              <input
                value={urlBranch}
                onChange={(e) => setUrlBranch(e.target.value)}
                placeholder="main"
                className="w-full rounded-lg px-3 py-2 ag-text-nav text-white outline-none w-48 ag-input"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving || !repoUrl.trim()} className="ag-btn-primary">
                {saving ? (
                  <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin border-[#0a0c10]" />
                ) : (
                  <CoolIcon name="plus" tone="default" size={16} className="!text-[#0a0c10]" />
                )}
                Add repository
              </button>
              <button type="button" onClick={resetAdd} className="ag-text-nav text-[var(--ag-text-muted)] hover:text-white px-2">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Docker Image Form */}
      {addMode === "docker" && (
        <form onSubmit={handleAddDocker} className="ag-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="ag-text-section">Add Docker image</h2>
            <button type="button" onClick={resetAdd} className="hover:opacity-80">
              <CoolIcon name="close" tone="muted" size={16} />
            </button>
          </div>
          <input
            required
            autoFocus
            placeholder="nginx:latest  or  ghcr.io/org/image:tag"
            value={dockerImage}
            onChange={(e) => setDockerImage(e.target.value)}
            className="w-full rounded-lg px-3 py-2 ag-text-nav text-white outline-none ag-input"
          />
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="ag-btn-primary">
              {saving && (
                <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin border-[#0a0c10]" />
              )}
              Add image
            </button>
            <button type="button" onClick={resetAdd} className="ag-text-nav text-[var(--ag-text-muted)] px-2">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Repo List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-2 animate-spin ag-spinner" />
        </div>
      ) : repos.length === 0 ? (
        <div className="ag-card p-12 text-center ag-text-body">
          No targets added yet. Add a GitHub repo or Docker image to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {repos.map((repo) => (
            <div key={repo.id} className="ag-card p-4 flex items-center gap-4">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: "var(--ag-bg)",
                  border: "1px solid var(--ag-border)",
                }}
              >
                <CoolIcon
                  name={repo.targetType === "GIT_REPO" ? "code" : "cloud"}
                  tone="primary"
                  size={20}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="ag-text-title truncate">
                  {repo.githubRepoFullName ?? repo.dockerImage}
                </p>
                <p className="ag-text-meta mt-0.5">
                  {repo.targetType === "GIT_REPO"
                    ? `Branch: ${repo.defaultBranch}`
                    : "Docker image"}{" "}
                  · Last scanned: {formatDate(repo.lastScannedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openScanModal(repo)}
                  disabled={!!triggering}
                  className="ag-btn-primary text-[length:var(--ag-text-body)] px-3 py-1.5"
                  style={{ fontSize: "var(--ag-text-body)" }}
                >
                  {triggering === repo.id ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent animate-spin border-[#0a0c10]" />
                  ) : (
                    <CoolIcon name="play" tone="default" size={14} className="!text-[#0a0c10]" />
                  )}
                  {triggering === repo.id ? "Starting…" : "Scan"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(repo.id)}
                  className="p-1.5 rounded hover:opacity-80"
                >
                  <CoolIcon name="trash" tone="danger" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* ── Scan Options Modal ─────────────────────────────────────────── */}
    {scanModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div
          className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col ag-card p-0"
          style={{ maxHeight: "calc(100vh - 2rem)" }}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b ag-divider">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: "color-mix(in srgb, var(--ag-cyan) 14%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--ag-cyan) 32%, transparent)",
                }}
              >
                <CoolIcon
                  name={scanModal.step === "detecting" ? "data" : "settings"}
                  tone="primary"
                  size={20}
                  className={scanModal.step === "detecting" ? "animate-pulse" : ""}
                />
              </div>
              <div className="min-w-0">
                <p className="ag-text-title">
                  {scanModal.step === "detecting" ? "Detecting tech stack" : "Configure scan"}
                </p>
                <p className="ag-text-meta truncate max-w-[220px]">
                  {scanModal.repo.githubRepoFullName ?? scanModal.repo.dockerImage}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setScanModal(null)} className="hover:opacity-80 shrink-0">
              <CoolIcon name="close" tone="muted" size={20} />
            </button>
          </div>

          {scanModal.step === "detecting" && (
            <div className="px-6 py-12 flex flex-col items-center gap-4">
              <div className="h-10 w-10 rounded-full border-2 animate-spin ag-spinner" />
              <p className="ag-text-nav text-[var(--ag-text-muted)]">Cloning repo &amp; scanning for tech stack…</p>
              <p className="ag-text-body">This takes a few seconds</p>
            </div>
          )}

          {/* ── Step 2: select tools ── */}
          {scanModal.step === "select" && (
            <>
              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 min-h-0">
              {/* Detected stacks */}
              <div className="px-6 pt-5 pb-3">
                <p className="ag-text-label mb-3">Detected tech stack</p>
                {scanModal.detectError && (
                  <p className="ag-text-body mb-3" style={{ color: "var(--ag-warning)" }}>{scanModal.detectError}</p>
                )}
                {scanModal.detectedStacks.length === 0 && !scanModal.detectError ? (
                  <p className="ag-text-body italic">Nothing specific detected — generic scanners recommended.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {scanModal.detectedStacks.map((s) => (
                      <span
                        key={s}
                        className="ag-text-meta px-2.5 py-1 rounded-full"
                        style={{
                          background: "color-mix(in srgb, var(--ag-cyan) 12%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--ag-cyan) 30%, transparent)",
                          color: "var(--ag-cyan)",
                        }}
                      >
                        {TECH_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mx-6 border-t ag-divider" />

              <div className="px-6 py-4 space-y-2.5">
                <p className="ag-text-label mb-3">Scanners to run</p>
                {TOOL_CATALOGUE.filter((t) =>
                  (t.forTypes as readonly string[]).includes(scanModal.repo.targetType)
                ).map((tool) => {
                  const checked     = scanModal.selectedTools.includes(tool.name);
                  const recommended = scanModal.recommendedTools.includes(tool.name);
                  return (
                    <label
                      key={tool.name}
                      onClick={() => toggleTool(tool.name)}
                      className="flex items-start gap-3 rounded-xl p-3.5 cursor-pointer transition-all select-none"
                      style={
                        checked
                          ? {
                              border: "1px solid color-mix(in srgb, var(--ag-cyan) 45%, transparent)",
                              background: "color-mix(in srgb, var(--ag-cyan) 8%, transparent)",
                            }
                          : { border: "1px solid var(--ag-border)", background: "transparent" }
                      }
                    >
                      <div
                        className="h-4 w-4 rounded flex items-center justify-center shrink-0 mt-0.5 transition-all"
                        style={
                          checked
                            ? { background: "var(--ag-cyan)", border: "1px solid var(--ag-cyan)" }
                            : { background: "transparent", border: "1px solid var(--ag-border)" }
                        }
                      >
                        {checked && (
                          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="ag-text-title font-medium">{tool.label}</span>
                          {recommended && (
                            <span
                              className="ag-text-label px-1.5 py-0.5 rounded-full normal-case"
                              style={{
                                background: "color-mix(in srgb, var(--ag-safe) 12%, transparent)",
                                color: "var(--ag-safe)",
                                border: "1px solid color-mix(in srgb, var(--ag-safe) 28%, transparent)",
                              }}
                            >
                              recommended
                            </span>
                          )}
                        </div>
                        <p className="ag-text-meta mt-0.5">{tool.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              </div>{/* end scrollable body */}

              {/* Footer — always visible */}
              <div className="px-6 py-4 flex items-center justify-between gap-3 shrink-0 border-t ag-divider">
                <span className="ag-text-body">
                  {scanModal.selectedTools.length} scanner{scanModal.selectedTools.length !== 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setScanModal(null)}
                    className="ag-text-nav px-3 py-2 text-[var(--ag-text-muted)] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={scanModal.selectedTools.length === 0}
                    className="ag-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CoolIcon name="shield-check" tone="default" size={16} className="!text-[#0a0c10]" />
                    Start scan
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    )}
    </>
  );
}
