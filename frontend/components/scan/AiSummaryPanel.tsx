"use client";

import { useState } from "react";
import { AiAnalysis, Scan } from "@/types";
import { Brain, TrendingUp, ShieldCheck, Info, RotateCcw, Loader2 } from "lucide-react";
import { severityColor } from "@/lib/utils";
import { aiApi } from "@/lib/api";

interface Props {
  analysis: AiAnalysis | null;
  analysisLoaded: boolean;
  scan: Scan;
  onAnalysisRetried?: () => void;
}

export function AiSummaryPanel({ analysis, analysisLoaded, scan, onAnalysisRetried }: Props) {
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    setRetryMessage(null);
    try {
      const res = await aiApi.retryAnalysis(scan.id);
      setRetryMessage(res.message);
      // Poll for result every 10 s for up to 5 minutes
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          await aiApi.getAnalysis(scan.id);
          clearInterval(interval);
          onAnalysisRetried?.();
        } catch {
          // 204 No Content means not ready yet
        }
        if (attempts >= 30) clearInterval(interval);
      }, 10_000);
    } catch (err: any) {
      setRetryMessage(err?.response?.data?.error ?? "Failed to queue AI analysis. Try again.");
    } finally {
      setRetrying(false);
    }
  }

  // Scan not finished yet
  if (scan.status !== "COMPLETED") {
    return (
      <div
        className="rounded-xl p-8 text-center text-sm"
        style={{ background: "#161b22", border: "1px solid #30363d", color: "#6e7681" }}
      >
        AI analysis will be available once the scan completes.
      </div>
    );
  }

  // Scan complete but still fetching for the first time
  if (!analysisLoaded) {
    return (
      <div
        className="rounded-xl p-8 text-center space-y-3"
        style={{ background: "#161b22", border: "1px solid #30363d" }}
      >
        <div
          className="h-8 w-8 rounded-full border-2 animate-spin mx-auto"
          style={{ borderColor: "#6366f1", borderTopColor: "transparent" }}
        />
        <p className="text-sm" style={{ color: "#6e7681" }}>Loading AI analysis…</p>
      </div>
    );
  }

  // Clean scan — no findings
  const totalFindings =
    scan.totalCritical + scan.totalHigh + scan.totalMedium + scan.totalLow + scan.totalInfo;
  if (!analysis && totalFindings === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center space-y-3"
        style={{ background: "#161b22", border: "1px solid #30363d" }}
      >
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto"
          style={{ background: "rgba(63,185,80,0.12)", border: "1px solid rgba(63,185,80,0.25)" }}
        >
          <ShieldCheck className="h-6 w-6" style={{ color: "#3fb950" }} />
        </div>
        <p className="font-medium" style={{ color: "#c9d1d9" }}>Clean scan — no vulnerabilities found</p>
        <p className="text-xs" style={{ color: "#6e7681" }}>
          AI deep analysis is skipped when there is nothing to prioritize.
        </p>
      </div>
    );
  }

  // Analysis not available — show retry option
  if (!analysis) {
    return (
      <div
        className="rounded-xl p-6 space-y-4"
        style={{ background: "#161b22", border: "1px solid #30363d" }}
      >
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#6e7681" }} />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">AI analysis not available</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "#6e7681" }}>
              The AI service did not produce an analysis for this scan. This can happen if the
              AI endpoint was temporarily unreachable. You can retry without re-running the full scan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: retrying ? "rgba(99,102,241,0.05)" : "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.3)",
              color: "#818cf8",
              cursor: retrying ? "not-allowed" : "pointer",
            }}
          >
            {retrying ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Queuing…</>
            ) : (
              <><RotateCcw className="h-4 w-4" /> Retry AI Analysis</>
            )}
          </button>

          {retryMessage && (
            <p className="text-xs" style={{ color: retryMessage.startsWith("Failed") ? "#f85149" : "#3fb950" }}>
              {retryMessage}
            </p>
          )}
        </div>

        {retryMessage && !retryMessage.startsWith("Failed") && (
          <p className="text-xs" style={{ color: "#6e7681" }}>
            Analysis is running in the background. This page will update automatically when complete.
          </p>
        )}
      </div>
    );
  }

  // ── Analysis available ───────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Executive summary */}
      <div
        className="rounded-xl p-5"
        style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}
      >
        <div className="flex items-center gap-2 font-semibold text-sm mb-3" style={{ color: "#818cf8" }}>
          <Brain className="h-4 w-4" /> Executive Summary
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "#c9d1d9" }}>
          {analysis.executiveSummary}
        </p>
        <p className="text-xs mt-3" style={{ color: "#484f58" }}>Model: {analysis.modelUsed}</p>
      </div>

      {/* Top risks */}
      {analysis.topRisks.length > 0 && (
        <div
          className="rounded-xl p-5"
          style={{ background: "#161b22", border: "1px solid #30363d" }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm mb-4" style={{ color: "#e3b341" }}>
            <TrendingUp className="h-4 w-4" /> Top Risks
          </div>
          <div className="space-y-3">
            {analysis.topRisks.map((risk, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xs font-bold mt-0.5 w-4 shrink-0" style={{ color: "#6e7681" }}>
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border shrink-0 ${severityColor(risk.severity)}`}
                    >
                      {risk.severity}
                    </span>
                    <span className="text-sm text-white font-medium">{risk.title}</span>
                    {risk.cveId && (
                      <span className="text-xs font-mono" style={{ color: "#6e7681" }}>{risk.cveId}</span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#818cf8" }}>
                    AI Risk Score: {Number(risk.aiRiskScore).toFixed(1)} / 10
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full report */}
      {analysis.prioritizedFindingsMd && (
        <div
          className="rounded-xl p-5"
          style={{ background: "#161b22", border: "1px solid #30363d" }}
        >
          <p
            className="text-[11px] font-semibold tracking-wider uppercase mb-3"
            style={{ color: "#6e7681" }}
          >
            Full AI Report
          </p>
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: "#c9d1d9" }}>
            {analysis.prioritizedFindingsMd}
          </pre>
        </div>
      )}
    </div>
  );
}
