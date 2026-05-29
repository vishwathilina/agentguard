"use client";

import { useEffect, useState, useMemo } from "react";
import { repositoriesApi, scansApi, githubApi, GitHubRepo } from "@/lib/api";
import { Repository } from "@/types";
import { formatDate } from "@/lib/utils";
import {
  GitBranch, Plus, Trash2, Play, Container, Search,
  Lock, Star, X, ChevronDown, Loader2, ShieldCheck, Settings2, Cpu,
} from "lucide-react";
import { useRouter } from "next/navigation";

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
    name: "OWASP_DEPENDENCY_CHECK",
    label: "OWASP Dep-Check",
    desc: "Checks Java/Maven/Gradle dependencies against CVE database.",
    forTypes: ["GIT_REPO"],
  },
  {
    name: "KUBE_BENCH",
    label: "Kubernetes config",
    desc: "Scans Kubernetes manifests for security misconfigurations.",
    forTypes: ["GIT_REPO"],
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
        .filter((t) => t.forTypes.includes(repo.targetType as any))
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
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
          >
            <GitBranch className="h-4 w-4" style={{ color: "#818cf8" }} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white leading-none">Repositories</h1>
            <p className="text-[11px] mt-0.5" style={{ color: "#8b949e" }}>Manage repos and Docker images to scan.</p>
          </div>
        </div>
        {!addMode && (
          <div className="flex gap-2">
            <button
              onClick={openGitHub}
              className="flex items-center gap-2 text-white text-xs font-medium px-3 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ background: "#6366f1" }}
            >
              <GitBranch className="h-3.5 w-3.5" /> My Repos
            </button>
            <button
              onClick={() => setAddMode("url")}
              className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              style={{ background: "#161b22", border: "1px solid #30363d", color: "#c9d1d9" }}
            >
              <Plus className="h-3.5 w-3.5" /> Add by URL
            </button>
            <button
              onClick={() => setAddMode("docker")}
              className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              style={{ background: "#161b22", border: "1px solid #30363d", color: "#c9d1d9" }}
            >
              <Container className="h-3.5 w-3.5" /> Docker Image
            </button>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-red-950/60 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-200" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* GitHub Repo Picker */}
      {addMode === "github" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#161b22", border: "1px solid #30363d" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #30363d" }}>
            <h2 className="text-sm font-semibold text-white">Select a GitHub Repository</h2>
            <button onClick={resetAdd} style={{ color: "#6e7681" }} className="hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3" style={{ borderBottom: "1px solid #30363d" }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#6e7681" }} />
              <input
                autoFocus
                value={ghSearch}
                onChange={(e) => setGhSearch(e.target.value)}
                placeholder="Search repositories..."
                className="w-full rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none"
                style={{ background: "#0d1117", border: "1px solid #30363d" }}
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto" style={{ borderBottom: "1px solid #21262d" }}>
            {ghLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#818cf8" }} />
              </div>
            ) : ghError ? (
              <p className="text-center text-sm py-10 px-4" style={{ color: "#f85149" }}>{ghError}</p>
            ) : filteredGhRepos.length === 0 ? (
              <p className="text-center text-sm py-10" style={{ color: "#6e7681" }}>No repositories found.</p>
            ) : (
              filteredGhRepos.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedRepo(r); setBranch(r.defaultBranch); }}
                  className="w-full text-left px-5 py-3 flex items-start gap-3 transition-colors"
                  style={
                    selectedRepo?.id === r.id
                      ? { background: "rgba(99,102,241,0.08)", borderLeft: "2px solid #6366f1" }
                      : { borderLeft: "2px solid transparent" }
                  }
                  onMouseEnter={(e) => { if (selectedRepo?.id !== r.id) e.currentTarget.style.background = "#0d1117"; }}
                  onMouseLeave={(e) => { if (selectedRepo?.id !== r.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <GitBranch className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#6e7681" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium truncate">{r.fullName}</span>
                      {r.isPrivate && <Lock className="h-3 w-3 shrink-0" style={{ color: "#6e7681" }} />}
                      {r.language && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "#0d1117", color: "#8b949e" }}
                        >
                          {r.language}
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="text-xs truncate mt-0.5" style={{ color: "#6e7681" }}>{r.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs shrink-0" style={{ color: "#6e7681" }}>
                    <Star className="h-3 w-3" />
                    {r.stargazersCount}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Branch + confirm */}
          {selectedRepo && (
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderTop: "1px solid #30363d" }}>
              <div className="flex-1">
                <p className="text-xs mb-1" style={{ color: "#8b949e" }}>
                  Selected: <span className="text-white">{selectedRepo.fullName}</span>
                </p>
                <div className="flex items-center gap-2">
                  <ChevronDown className="h-4 w-4" style={{ color: "#6e7681" }} />
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="Branch"
                    className="rounded px-2 py-1 text-sm text-white w-32 outline-none"
                    style={{ background: "#0d1117", border: "1px solid #30363d" }}
                  />
                </div>
              </div>
              <button
                onClick={handleAddGitHub}
                disabled={saving}
                className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "#6366f1" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Repository
              </button>
              <button onClick={resetAdd} className="text-sm hover:text-white transition-colors" style={{ color: "#6e7681" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add by URL Form */}
      {addMode === "url" && (
        <form
          onSubmit={handleAddByUrl}
          className="rounded-xl overflow-hidden"
          style={{ background: "#161b22", border: "1px solid #30363d" }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #30363d" }}>
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" style={{ color: "#818cf8" }} />
              <h2 className="text-sm font-semibold text-white">Add GitHub Repository by URL</h2>
            </div>
            <button type="button" onClick={resetAdd} style={{ color: "#6e7681" }} className="hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "#8b949e" }}>
                Repository URL or slug
              </label>
              <input
                required
                autoFocus
                value={repoUrl}
                onChange={(e) => { setRepoUrl(e.target.value); setUrlError(null); }}
                placeholder="https://github.com/owner/repo  or  owner/repo"
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none font-mono placeholder:font-sans"
                style={{ background: "#0d1117", border: `1px solid ${urlError ? "#f85149" : "#30363d"}` }}
              />
              {urlError && (
                <p className="text-xs" style={{ color: "#f85149" }}>{urlError}</p>
              )}
              <p className="text-[11px]" style={{ color: "#6e7681" }}>
                Supports public and private repos you have access to.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "#8b949e" }}>
                Branch
              </label>
              <input
                value={urlBranch}
                onChange={(e) => setUrlBranch(e.target.value)}
                placeholder="main"
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none w-48"
                style={{ background: "#0d1117", border: "1px solid #30363d" }}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving || !repoUrl.trim()}
                className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "#6366f1" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Repository
              </button>
              <button type="button" onClick={resetAdd} className="text-sm px-2 hover:text-white transition-colors" style={{ color: "#6e7681" }}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Docker Image Form */}
      {addMode === "docker" && (
        <form
          onSubmit={handleAddDocker}
          className="rounded-xl p-5 space-y-4"
          style={{ background: "#161b22", border: "1px solid #30363d" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Add Docker Image</h2>
            <button type="button" onClick={resetAdd} style={{ color: "#6e7681" }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            required
            autoFocus
            placeholder="nginx:latest  or  ghcr.io/org/image:tag"
            value={dockerImage}
            onChange={(e) => setDockerImage(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ background: "#0d1117", border: "1px solid #30363d" }}
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#6366f1" }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add Image
            </button>
            <button type="button" onClick={resetAdd} className="text-sm px-2" style={{ color: "#6e7681" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Repo List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#818cf8" }} />
        </div>
      ) : repos.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center text-sm"
          style={{ background: "#161b22", border: "1px solid #30363d", color: "#6e7681" }}
        >
          No targets added yet. Add a GitHub repo or Docker image to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="rounded-xl p-4 flex items-center gap-4 transition-colors"
              style={{ background: "#161b22", border: "1px solid #30363d" }}
            >
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "#0d1117", border: "1px solid #21262d" }}
              >
                {repo.targetType === "GIT_REPO" ? (
                  <GitBranch className="h-5 w-5" style={{ color: "#818cf8" }} />
                ) : (
                  <Container className="h-5 w-5" style={{ color: "#38bdf8" }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {repo.githubRepoFullName ?? repo.dockerImage}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#6e7681" }}>
                  {repo.targetType === "GIT_REPO"
                    ? `Branch: ${repo.defaultBranch}`
                    : "Docker Image"}{" "}
                  · Last scanned: {formatDate(repo.lastScannedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openScanModal(repo)}
                  disabled={!!triggering}
                  className="flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#6366f1" }}
                >
                  {triggering === repo.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Play className="h-3.5 w-3.5" />}
                  {triggering === repo.id ? "Starting..." : "Scan"}
                </button>
                <button
                  onClick={() => handleDelete(repo.id)}
                  className="p-1.5 rounded transition-colors hover:text-red-400"
                  style={{ color: "#6e7681" }}
                >
                  <Trash2 className="h-4 w-4" />
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
          className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col"
          style={{ background: "#161b22", border: "1px solid #30363d", maxHeight: "calc(100vh - 2rem)" }}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid #30363d" }}>
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
              >
                {scanModal.step === "detecting"
                  ? <Cpu className="h-5 w-5 animate-pulse" style={{ color: "#818cf8" }} />
                  : <Settings2 className="h-5 w-5" style={{ color: "#818cf8" }} />}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {scanModal.step === "detecting" ? "Detecting Tech Stack" : "Configure Scan"}
                </p>
                <p className="text-xs truncate max-w-[220px]" style={{ color: "#8b949e" }}>
                  {scanModal.repo.githubRepoFullName ?? scanModal.repo.dockerImage}
                </p>
              </div>
            </div>
            <button onClick={() => setScanModal(null)} style={{ color: "#6e7681" }} className="hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── Step 1: detecting ── */}
          {scanModal.step === "detecting" && (
            <div className="px-6 py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#818cf8" }} />
              <p className="text-sm" style={{ color: "#8b949e" }}>Cloning repo &amp; scanning for tech stack…</p>
              <p className="text-xs" style={{ color: "#6e7681" }}>This takes a few seconds</p>
            </div>
          )}

          {/* ── Step 2: select tools ── */}
          {scanModal.step === "select" && (
            <>
              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 min-h-0">
              {/* Detected stacks */}
              <div className="px-6 pt-5 pb-3">
                <p className="text-[11px] font-semibold tracking-wider uppercase mb-3" style={{ color: "#6e7681" }}>
                  Detected Tech Stack
                </p>
                {scanModal.detectError && (
                  <p className="text-xs mb-3" style={{ color: "#d29922" }}>{scanModal.detectError}</p>
                )}
                {scanModal.detectedStacks.length === 0 && !scanModal.detectError ? (
                  <p className="text-xs italic" style={{ color: "#6e7681" }}>Nothing specific detected — generic scanners recommended.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {scanModal.detectedStacks.map((s) => (
                      <span
                        key={s}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}
                      >
                        {TECH_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mx-6" style={{ borderTop: "1px solid #30363d" }} />

              {/* Tool checkboxes */}
              <div className="px-6 py-4 space-y-2.5">
                <p className="text-[11px] font-semibold tracking-wider uppercase mb-3" style={{ color: "#6e7681" }}>
                  Scanners to run
                </p>
                {TOOL_CATALOGUE.filter((t) =>
                  t.forTypes.includes(scanModal.repo.targetType as any)
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
                          ? { border: "1px solid rgba(99,102,241,0.5)", background: "rgba(99,102,241,0.08)" }
                          : { border: "1px solid #30363d", background: "transparent" }
                      }
                    >
                      {/* Custom checkbox */}
                      <div
                        className="h-4 w-4 rounded flex items-center justify-center shrink-0 mt-0.5 transition-all"
                        style={
                          checked
                            ? { background: "#6366f1", border: "1px solid #6366f1" }
                            : { background: "transparent", border: "1px solid #484f58" }
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
                          <span className="text-sm font-medium text-white">{tool.label}</span>
                          {recommended && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(63,185,80,0.12)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.25)" }}
                            >
                              recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>{tool.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              </div>{/* end scrollable body */}

              {/* Footer — always visible */}
              <div
                className="px-6 py-4 flex items-center justify-between gap-3 shrink-0"
                style={{ borderTop: "1px solid #30363d" }}
              >
                <span className="text-xs" style={{ color: "#6e7681" }}>
                  {scanModal.selectedTools.length} scanner{scanModal.selectedTools.length !== 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setScanModal(null)}
                    className="text-sm px-3 py-2 rounded-lg transition-colors hover:text-white"
                    style={{ color: "#8b949e" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleScan}
                    disabled={scanModal.selectedTools.length === 0}
                    className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "#6366f1" }}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Start Scan
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
