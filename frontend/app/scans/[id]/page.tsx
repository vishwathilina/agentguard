"use client";

import { useEffect, useState, useRef, useCallback, type RefObject } from "react";
import { useParams } from "next/navigation";
import { scansApi, vulnerabilitiesApi, aiApi } from "@/lib/api";
import { Scan, ScanToolRun, Vulnerability, AiAnalysis, Severity } from "@/types";
import { formatDate, severityColor, scoreColor } from "@/lib/utils";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { VulnerabilityRow } from "@/components/scan/VulnerabilityRow";
import { AiSummaryPanel } from "@/components/scan/AiSummaryPanel";
import { ScanStatusBadge } from "@/components/scan/ScanStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoolIcon } from "@/components/icons/CoolIcon";
import Link from "next/link";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

const TECH_LABEL: Record<string, string> = {
  SPRING_BOOT:    "Spring Boot",
  GRADLE_JAVA:    "Gradle / Java",
  NODE_JS:        "Node.js",
  PYTHON:         "Python",
  GO:             "Go",
  DOCKER:         "Docker",
  KUBERNETES:     "Kubernetes",
  TERRAFORM:      "Terraform",
  GITHUB_ACTIONS: "GitHub Actions",
};

const TOOL_LABEL: Record<string, string> = {
  GITLEAKS:         "Gitleaks",
  NPM_AUDIT:        "npm audit",
  TRIVY:            "Trivy",
  TFSEC:            "tfsec",
  KUBE_BENCH:       "Kubernetes config",
  OWASP_DEP_CHECK:  "OWASP Dep-Check",
  SEMGREP:          "Semgrep",
  CHECKOV:          "Checkov",
  HADOLINT:         "Hadolint",
  BANDIT:           "Bandit",
  OSV_SCANNER:      "OSV Scanner",
  GRYPE:            "Grype",
  DOCKLE:           "Dockle",
};

function deriveScanners(stacks: string[], targetType: string): string[] {
  const s = new Set(stacks);
  const scanners: string[] = [];
  if (targetType === "GIT_REPO") {
    scanners.push("Gitleaks", "Semgrep");
  }
  if (targetType === "DOCKER_IMAGE" || s.has("DOCKER")) {
    scanners.push("Trivy", "Grype");
    if (targetType === "DOCKER_IMAGE") scanners.push("Dockle");
    if (s.has("DOCKER")) scanners.push("Hadolint");
  }
  if (s.has("TERRAFORM")) scanners.push("tfsec", "Checkov");
  if (s.has("KUBERNETES")) scanners.push("Kubernetes config", "Checkov");
  if (s.has("NODE_JS")) scanners.push("npm audit");
  if (s.has("PYTHON")) scanners.push("Bandit");
  if (s.has("NODE_JS") || s.has("PYTHON") || s.has("GO")) scanners.push("OSV Scanner");
  if (s.has("SPRING_BOOT") || s.has("GRADLE_JAVA")) scanners.push("OWASP Dep-Check");
  return [...new Set(scanners)];
}

interface LogEntry {
  id:      number;
  type:    string;
  level:   string;
  message: string;
  tool?:   string;
  found?:  number;
  ts:      number;
}

interface CompletePayload extends LogEntry {
  status?:             string;
  securityScore?:      number;
  totalCritical?:      number;
  totalHigh?:          number;
  totalMedium?:        number;
  totalLow?:           number;
  totalInfo?:          number;
  detectedTechStacks?: string[];
  startedAt?:          string;
  completedAt?:        string;
}

function applyCompletePayload(prev: Scan, data: CompletePayload): Scan {
  return {
    ...prev,
    status:             "COMPLETED",
    securityScore:      data.securityScore ?? prev.securityScore,
    totalCritical:      data.totalCritical ?? prev.totalCritical,
    totalHigh:          data.totalHigh ?? prev.totalHigh,
    totalMedium:        data.totalMedium ?? prev.totalMedium,
    totalLow:           data.totalLow ?? prev.totalLow,
    totalInfo:          data.totalInfo ?? prev.totalInfo,
    detectedTechStacks: data.detectedTechStacks ?? prev.detectedTechStacks ?? [],
    startedAt:          data.startedAt ?? prev.startedAt,
    completedAt:        data.completedAt ?? prev.completedAt,
  };
}

function logColor(level: string) {
  switch (level) {
    case "ERROR": return "text-[var(--ag-danger)]";
    case "WARN":  return "text-[var(--ag-warning)]";
    case "OK":    return "text-[var(--ag-safe)]";
    case "DONE":  return "text-[var(--ag-cyan)] font-semibold";
    default:      return "text-[var(--ag-text-muted)]";
  }
}

function logPrefix(type: string) {
  switch (type) {
    case "TOOL_START": return "text-[var(--ag-cyan)]";
    case "TOOL_DONE":  return "text-[var(--ag-safe)]";
    case "TOOL_ERROR": return "text-[var(--ag-danger)]";
    case "COMPLETE":   return "text-[var(--ag-cyan)]";
    case "FAILED":     return "text-[var(--ag-danger)]";
    default:           return "text-[var(--ag-text-muted)] opacity-60";
  }
}

function logsStorageKey(scanId: string) {
  return `agentguard-scan-logs-${scanId}`;
}

/** Messages that are UI-only and must never be persisted or replayed from storage. */
function isTransientLog(entry: LogEntry): boolean {
  return (
    entry.message.startsWith("Connected —") ||
    entry.message.startsWith("WebSocket unavailable")
  );
}

function loadStoredLogs(scanId: string): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(logsStorageKey(scanId));
    if (!raw) return [];
    // Strip transient entries that may have been stored by older versions
    return (JSON.parse(raw) as LogEntry[]).filter((e) => !isTransientLog(e));
  } catch {
    return [];
  }
}

function buildLogsFromScan(scan: Scan, runs: ScanToolRun[]): LogEntry[] {
  const ts = scan.startedAt ? new Date(scan.startedAt).getTime() : Date.now();
  let i = 0;
  const entries: LogEntry[] = [
    { id: ++i, type: "LOG", level: "INFO", message: "Scan started", ts },
  ];

  if ((scan.detectedTechStacks ?? []).length > 0) {
    entries.push({
      id: ++i,
      type: "LOG",
      level: "INFO",
      message: `Detected: ${scan.detectedTechStacks.join(", ")}`,
      ts: ts + 1,
    });
  }

  for (const run of runs) {
    const runTs = run.startedAt ? new Date(run.startedAt).getTime() : ts + i;
    entries.push({
      id: ++i,
      type: "TOOL_START",
      level: "INFO",
      message: `Running ${run.toolName}…`,
      tool: run.toolName,
      ts: runTs,
    });

    if (run.status === "COMPLETED") {
      entries.push({
        id: ++i,
        type: "TOOL_DONE",
        level: "OK",
        message: `${run.toolName} — completed`,
        tool: run.toolName,
        ts: runTs + 1,
      });
    } else if (run.status === "FAILED") {
      entries.push({
        id: ++i,
        type: "TOOL_ERROR",
        level: "ERROR",
        message: `${run.toolName} failed: ${run.errorMessage ?? "unknown error"}`,
        tool: run.toolName,
        ts: runTs + 1,
      });
    }
  }

  const endTs = scan.completedAt ? new Date(scan.completedAt).getTime() : ts + i + 1;
  if (scan.status === "COMPLETED") {
    entries.push({
      id: ++i,
      type: "COMPLETE",
      level: "DONE",
      message: `Scan complete — security score: ${scan.securityScore ?? "—"}/100`,
      ts: endTs,
    });
  } else if (scan.status === "FAILED") {
    entries.push({
      id: ++i,
      type: "FAILED",
      level: "ERROR",
      message: "Scan failed",
      ts: endTs,
    });
  }

  return entries;
}

function ScanLogTerminal({
  scanId,
  logs,
  isLive,
  wsConnected,
  logEndRef,
}: {
  scanId: string;
  logs: LogEntry[];
  isLive: boolean;
  wsConnected: boolean;
  logEndRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="ag-card overflow-hidden p-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b ag-divider ag-card-elevated rounded-none">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--ag-danger)" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--ag-warning)" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--ag-safe)" }} />
        <span className="ml-3 ag-text-meta font-mono">
          scan:{scanId.slice(0, 8)}…
        </span>
        <span className="ml-auto ag-text-meta font-mono flex items-center gap-2">
          {logs.length} events
          {isLive ? (
            wsConnected ? (
              <span className="inline-flex items-center gap-1" style={{ color: "var(--ag-safe)" }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--ag-safe)" }} />
                live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1" style={{ color: "var(--ag-warning)" }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--ag-warning)" }} />
                connecting…
              </span>
            )
          ) : (
            <span className="opacity-50">archived</span>
          )}
        </span>
      </div>

      <div
        className="h-96 overflow-y-auto p-4 font-mono ag-text-body space-y-0.5"
        style={{ background: "var(--ag-bg)" }}
      >
        {logs.length === 0 ? (
          <div className="flex items-center gap-2 font-mono ag-text-body">
            {isLive
              ? <span className="animate-pulse">Waiting for scan events…</span>
              : <span>No log events recorded for this scan.</span>
            }
          </div>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="flex gap-3 leading-relaxed">
              <span className="shrink-0 select-none tabular-nums opacity-50">
                {new Date(entry.ts).toLocaleTimeString([], { hour12: false })}
              </span>
              <span className={`shrink-0 w-10 text-right ${logPrefix(entry.type)}`}>
                {entry.type === "TOOL_START" ? "START" :
                 entry.type === "TOOL_DONE"  ? " DONE" :
                 entry.type === "TOOL_ERROR" ? "ERROR" :
                 entry.type === "COMPLETE"   ? " DONE" :
                 entry.type === "FAILED"     ? " FAIL" : " INFO"}
              </span>
              <span className={logColor(entry.level)}>{entry.message}</span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [scan, setScan]         = useState<Scan | null>(null);
  const [toolRuns, setToolRuns] = useState<ScanToolRun[]>([]);
  const [vulns, setVulns]       = useState<Vulnerability[]>([]);
  const [analysis, setAnalysis]         = useState<AiAnalysis | null>(null);
  const [analysisLoaded, setAnalysisLoaded] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [wsConnected, setWsConnected]   = useState(false);
  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");
  const [logs, setLogs]         = useState<LogEntry[]>(() => loadStoredLogs(id));
  const [activeTab, setActiveTab] = useState("live");
  const logIdRef       = useRef(logs.length);
  // One-time cleanup: rewrite sessionStorage without any old transient entries
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(logsStorageKey(id));
      if (raw) {
        const clean = (JSON.parse(raw) as LogEntry[]).filter((e) => !isTransientLog(e));
        sessionStorage.setItem(logsStorageKey(id), JSON.stringify(clean));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const logEndRef      = useRef<HTMLDivElement>(null);
  const wsRef          = useRef<WebSocket | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiPollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prevent the WS effect from re-running just because scan.status changed
  const wsOpenedRef    = useRef(false);
  // Only log "Connected" once per mount (suppress reconnect duplicates)
  const wsConnectedRef = useRef(false);

  const addLog = useCallback((entry: Omit<LogEntry, "id">) => {
    setLogs((prev) => [...prev, { ...entry, id: ++logIdRef.current }]);
  }, []);

  // Persist logs for completed scan replay — never store transient entries
  useEffect(() => {
    if (logs.length === 0) return;
    try {
      const persistable = logs.filter((e) => !isTransientLog(e));
      if (persistable.length > 0) {
        sessionStorage.setItem(logsStorageKey(id), JSON.stringify(persistable));
      }
    } catch {
      // ignore quota errors
    }
  }, [id, logs]);

  const refreshScanDetails = useCallback(async () => {
    let s: Scan | null = null;
    try {
      s = await scansApi.get(id);
      setScan(s);
    } catch {
      // keep optimistic WS state if refetch fails
    }

    const isTerminal = s?.status === "COMPLETED" ||
                       s?.status === "FAILED"    ||
                       s?.status === "CANCELLED";

    // Always fetch tool runs
    try {
      const runs = await scansApi.toolRuns(id);
      setToolRuns(runs);

      if (isTerminal) {
        // Restore logs: prefer sessionStorage, fall back to rebuilding from tool runs
        const stored = loadStoredLogs(id);
        if (stored.length > 0) {
          setLogs(stored);
          logIdRef.current = stored.length;
        } else if (runs.length > 0) {
          setLogs((prev) => {
            if (prev.length > 0) return prev;
            const rebuilt = buildLogsFromScan(s!, runs);
            logIdRef.current = rebuilt.length;
            return rebuilt;
          });
        }
      }
    } catch {
      setToolRuns([]);
    }

    // Always fetch vulnerabilities — critical on page refresh after completion
    try {
      const v = await vulnerabilitiesApi.list(id, { size: 200 });
      setVulns(v.content ?? []);
    } catch {
      setVulns([]);
    }

    if (s?.status === "COMPLETED") {
      aiApi.getAnalysis(id)
        .then((a) => { setAnalysis(a); setAnalysisLoaded(true); })
        .catch(() => { setAnalysis(null); setAnalysisLoaded(true); });
    } else if (s && !isTerminal) {
      setAnalysisLoaded(false);
    }
    return s;
  }, [id]);

  const scheduleRefreshRetries = useCallback(() => {
    [500, 1500, 4000].forEach((delay) => {
      window.setTimeout(() => {
        refreshScanDetails().catch(() => {});
      }, delay);
    });
  }, [refreshScanDetails]);

  // Load initial scan data
  useEffect(() => {
    refreshScanDetails().finally(() => setLoading(false));
  }, [refreshScanDetails]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (aiPollRef.current) clearInterval(aiPollRef.current);
    };
  }, []);

  // Auto-scroll log terminal
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // WebSocket for live progress.
  // Depends only on `id` and whether scan has loaded — NOT on scan.status —
  // so status changes (QUEUED→RUNNING) don't tear down and recreate the socket.
  useEffect(() => {
    if (!scan) return;

    const isTerminal =
      scan.status === "COMPLETED" ||
      scan.status === "FAILED" ||
      scan.status === "CANCELLED";

    // Already in a terminal state on mount — no WS needed
    if (isTerminal) return;

    // Already opened for this mount cycle
    if (wsOpenedRef.current) return;
    wsOpenedRef.current = true;

    // Polling fallback — refresh scan every 8 s
    pollRef.current = setInterval(() => {
      refreshScanDetails().then((s) => {
        if (!s) return;
        if (s.status === "COMPLETED" || s.status === "FAILED") {
          clearInterval(pollRef.current!);
        }
      }).catch(() => {});
    }, 8000);

    // WebSocket for real-time events
    const ws = new WebSocket(`${WS_URL}/ws/scans/${id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      wsConnectedRef.current = true;
      setWsConnected(true);
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as CompletePayload;
        addLog(data);

        if (data.type === "LOG" && data.message.includes("Detected:")) {
          const stacks = data.message
            .replace(/^.*Detected:\s*/, "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (stacks.length > 0) {
            setScan((prev) => (prev ? { ...prev, detectedTechStacks: stacks } : prev));
          }
        }

        if (data.type === "TOOL_START") {
          setScan((prev) =>
            prev && prev.status === "QUEUED"
              ? { ...prev, status: "RUNNING", startedAt: prev.startedAt ?? new Date().toISOString() }
              : prev
          );
        }

        if (data.type === "COMPLETE") {
          setScan((prev) => (prev ? applyCompletePayload(prev, data) : prev));
          clearInterval(pollRef.current!);
          scheduleRefreshRetries();
          ws.close();
        }

        if (data.type === "FAILED") {
          setScan((prev) => (prev ? { ...prev, status: "FAILED" } : prev));
          clearInterval(pollRef.current!);
          scheduleRefreshRetries();
          ws.close();
        }
      } catch {}
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      ws.close();
      clearInterval(pollRef.current!);
      wsOpenedRef.current    = false;
      wsConnectedRef.current = false;
      setWsConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scan !== null]);

  const filteredVulns = severityFilter
    ? vulns.filter((v) => v.severity === severityFilter)
    : vulns;

  if (loading || !scan) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 animate-spin ag-spinner" />
      </div>
    );
  }

  const repoName = scan.repository.githubRepoFullName ?? scan.repository.dockerImage ?? "Unknown";
  const isActive = scan.status === "QUEUED" || scan.status === "RUNNING";
  const techStacks = scan.detectedTechStacks ?? [];
  const scannerLabels = toolRuns.length > 0
    ? toolRuns.map((r) => TOOL_LABEL[r.toolName] ?? r.toolName)
    : deriveScanners(techStacks, scan.repository.targetType);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <PageHeader
        icon="shield"
        tone="primary"
        title={repoName}
        subtitle={`${scan.branch ? `Branch: ${scan.branch} · ` : ""}Started: ${formatDate(scan.startedAt)}`}
        trailing={
          <Link
            href="/repositories"
            className="ag-btn-secondary ml-2 shrink-0"
            style={{ fontSize: "var(--ag-text-body)" }}
          >
            <CoolIcon name="chevron-down" tone="muted" size={14} className="rotate-90" />
            Infrastructure
          </Link>
        }
      >
        <div className="flex items-center gap-3 shrink-0">
          {scan.securityScore !== null && (
            <span className={`ag-text-metric-lg font-mono ${scoreColor(scan.securityScore)}`}>
              {scan.securityScore}
              <span className="ag-text-metric-denom">/100</span>
            </span>
          )}
          <ScanStatusBadge status={scan.status} />
        </div>
      </PageHeader>

      {scan.status === "FAILED" && (
        <div
          className="ag-card px-4 py-3 flex items-center gap-2 ag-text-nav"
          style={{
            background: "color-mix(in srgb, var(--ag-danger) 8%, transparent)",
            borderColor: "color-mix(in srgb, var(--ag-danger) 30%, transparent)",
            color: "var(--ag-danger)",
          }}
        >
          <CoolIcon name="warning" tone="danger" size={18} className="shrink-0" />
          This scan failed before it could finish. Restart the backend if you just updated code, then run a new scan from Infrastructure.
        </div>
      )}

      <div className="grid grid-cols-5 gap-3">
        {(["CRITICAL","HIGH","MEDIUM","LOW","INFO"] as Severity[]).map((s) => {
          const count = s === "CRITICAL" ? scan.totalCritical
                      : s === "HIGH"     ? scan.totalHigh
                      : s === "MEDIUM"   ? scan.totalMedium
                      : s === "LOW"      ? scan.totalLow
                      :                   scan.totalInfo;
          const isSelected = severityFilter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSeverityFilter((prev) => prev === s ? "" : s)}
              className={`ag-stat-card text-center transition-all border ${severityColor(s)} ${
                isSelected
                  ? "ring-2 ring-[var(--ag-cyan)] ring-offset-2 ring-offset-[var(--ag-bg)]"
                  : "hover:opacity-90"
              }`}
            >
              <p className="ag-text-metric-lg">{count}</p>
              <p className="ag-text-label mt-0.5">{s}</p>
            </button>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="ag-card flex w-full gap-1 p-1">
          {([
            { value: "live",             label: "Scan log",              extra: isActive ? (
              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--ag-safe)" }} />
            ) : null },
            { value: "vulnerabilities", label: `Vulnerabilities (${filteredVulns.length})`, extra: null },
            { value: "ai",              label: "AI analysis",             extra: null },
            { value: "tools",           label: "Tools",                   extra: null },
          ] as const).map(({ value, label, extra }) => {
            const selected = activeTab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 ag-text-nav font-medium transition-all ${
                  selected ? "text-[var(--ag-text)]" : "text-[var(--ag-text-muted)] hover:text-[var(--ag-text)]"
                }`}
                style={
                  selected
                    ? {
                        background: "color-mix(in srgb, var(--ag-cyan) 10%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--ag-cyan) 32%, transparent)",
                      }
                    : { background: "transparent", border: "1px solid transparent" }
                }
              >
                {label}
                {extra}
              </button>
            );
          })}
        </div>

        {/* ── Scan Log Terminal ── */}
        <TabsContent value="live" className="mt-4">
          <ScanLogTerminal
            scanId={id}
            logs={logs}
            isLive={isActive}
            wsConnected={wsConnected}
            logEndRef={logEndRef}
          />
        </TabsContent>

        {/* ── Vulnerabilities ── */}
        <TabsContent value="vulnerabilities" className="mt-4">
          {isActive && vulns.length === 0 ? (
            <div className="ag-card p-10 text-center ag-text-body">
              Scan in progress — vulnerabilities will appear here when complete.
            </div>
          ) : filteredVulns.length === 0 ? (
            <div className="ag-card p-10 text-center ag-text-body">
              No vulnerabilities found{severityFilter ? ` with severity ${severityFilter}` : ""}.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVulns.map((v) => (
                <VulnerabilityRow key={v.id} vulnerability={v} scanId={id} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── AI Analysis ── */}
        <TabsContent value="ai" className="mt-4">
          <AiSummaryPanel
            analysis={analysis}
            analysisLoaded={analysisLoaded}
            scan={scan}
            onAnalysisRetried={() => {
              setAnalysisLoaded(false);
              setAnalysis(null);
              if (aiPollRef.current) clearInterval(aiPollRef.current);
              aiPollRef.current = setInterval(() => {
                aiApi.getAnalysis(id)
                  .then((a) => {
                    setAnalysis(a);
                    setAnalysisLoaded(true);
                    if (aiPollRef.current) clearInterval(aiPollRef.current);
                    aiPollRef.current = null;
                  })
                  .catch(() => { /* not ready yet */ });
              }, 10_000);
              setTimeout(() => {
                if (aiPollRef.current) clearInterval(aiPollRef.current);
                aiPollRef.current = null;
                setAnalysisLoaded(true);
              }, 5 * 60_000);
            }}
          />
        </TabsContent>

        {/* ── Tools ── */}
        <TabsContent value="tools" className="mt-4 space-y-4">
          <div className="ag-card p-4">
            <p className="ag-text-label mb-3">Detected tech stack</p>
            {techStacks.length === 0 ? (
              <p className="ag-text-body">{isActive ? "Detecting…" : "Not yet detected."}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {techStacks.map((t) => (
                  <span
                    key={t}
                    className="ag-text-meta px-3 py-1 rounded-full"
                    style={{
                      background: "color-mix(in srgb, var(--ag-cyan) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--ag-cyan) 30%, transparent)",
                      color: "var(--ag-cyan)",
                    }}
                  >
                    {TECH_LABEL[t] ?? t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="ag-card p-4">
            <p className="ag-text-label mb-3">
              {toolRuns.length > 0 ? "Scanners run" : "Scanners"}
            </p>
            {scannerLabels.length === 0 ? (
              <p className="ag-text-body">{isActive ? "Waiting for scanners…" : "No scanners recorded."}</p>
            ) : toolRuns.length > 0 ? (
              <div className="space-y-2">
                {toolRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                    style={{ background: "var(--ag-bg)", border: "1px solid var(--ag-border)" }}
                  >
                    <span className="ag-text-title">{TOOL_LABEL[run.toolName] ?? run.toolName}</span>
                    <span
                      className="ag-text-meta px-2 py-0.5 rounded-full"
                      style={
                        run.status === "COMPLETED"
                          ? {
                              color: "var(--ag-safe)",
                              background: "color-mix(in srgb, var(--ag-safe) 12%, transparent)",
                              border: "1px solid color-mix(in srgb, var(--ag-safe) 28%, transparent)",
                            }
                          : run.status === "FAILED"
                            ? {
                                color: "var(--ag-danger)",
                                background: "color-mix(in srgb, var(--ag-danger) 12%, transparent)",
                                border: "1px solid color-mix(in srgb, var(--ag-danger) 28%, transparent)",
                              }
                            : {
                                color: "var(--ag-text-muted)",
                                background: "color-mix(in srgb, var(--ag-neutral) 10%, transparent)",
                                border: "1px solid var(--ag-border)",
                              }
                      }
                    >
                      {run.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {scannerLabels.map((s) => (
                  <span
                    key={s}
                    className="ag-text-meta px-3 py-1 rounded-full"
                    style={{
                      background: "color-mix(in srgb, var(--ag-cyan) 10%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--ag-cyan) 25%, transparent)",
                      color: "var(--ag-cyan)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
