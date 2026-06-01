"use client";

import { useState, useRef, useEffect } from "react";
import { AiAnalysis, Scan } from "@/types";
import { severityColor } from "@/lib/utils";
import { aiApi } from "@/lib/api";
import { CoolIcon } from "@/components/icons/CoolIcon";

interface Props {
  analysis: AiAnalysis | null;
  analysisLoaded: boolean;
  scan: Scan;
  onAnalysisRetried?: () => void;
}

export function AiSummaryPanel({ analysis, analysisLoaded, scan, onAnalysisRetried }: Props) {
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    setRetryMessage(null);
    try {
      const res = await aiApi.retryAnalysis(scan.id);
      setRetryMessage(res.message);
      if (pollRef.current) clearInterval(pollRef.current);
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          await aiApi.getAnalysis(scan.id);
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          onAnalysisRetried?.();
        } catch {
          // 204 No Content means not ready yet
        }
        if (attempts >= 30 && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 10_000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setRetryMessage(msg ?? "Failed to queue AI analysis. Try again.");
    } finally {
      setRetrying(false);
    }
  }

  if (scan.status !== "COMPLETED") {
    return (
      <div className="ag-card p-10 text-center ag-text-body">
        AI analysis will be available once the scan completes.
      </div>
    );
  }

  if (!analysisLoaded) {
    return (
      <div className="ag-card p-10 text-center space-y-3">
        <div className="h-8 w-8 rounded-full border-2 animate-spin ag-spinner mx-auto" />
        <p className="ag-text-body">Loading AI analysis…</p>
      </div>
    );
  }

  const totalFindings =
    scan.totalCritical + scan.totalHigh + scan.totalMedium + scan.totalLow + scan.totalInfo;
  if (!analysis && totalFindings === 0) {
    return (
      <div className="ag-card p-10 text-center space-y-3">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto"
          style={{
            background: "color-mix(in srgb, var(--ag-safe) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--ag-safe) 28%, transparent)",
          }}
        >
          <CoolIcon name="shield-check" tone="safe" size={24} />
        </div>
        <p className="ag-text-title">Clean scan — no vulnerabilities found</p>
        <p className="ag-text-body">
          AI deep analysis is skipped when there is nothing to prioritize.
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="ag-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <CoolIcon name="warning" tone="muted" size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="ag-text-title">AI analysis not available</p>
            <p className="ag-text-body mt-1 leading-relaxed">
              The AI service did not produce an analysis for this scan. This can happen if the
              AI endpoint was temporarily unreachable. You can retry without re-running the full scan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="ag-btn-secondary disabled:opacity-50"
          >
            {retrying ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin ag-spinner" />
                Queuing…
              </>
            ) : (
              <>
                <CoolIcon name="data" tone="primary" size={14} />
                Retry AI analysis
              </>
            )}
          </button>

          {retryMessage && (
            <p
              className="ag-text-body"
              style={{ color: retryMessage.startsWith("Failed") ? "var(--ag-danger)" : "var(--ag-safe)" }}
            >
              {retryMessage}
            </p>
          )}
        </div>

        {retryMessage && !retryMessage.startsWith("Failed") && (
          <p className="ag-text-body">
            Analysis is running in the background. This page will update automatically when complete.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="ag-card p-5"
        style={{
          background: "color-mix(in srgb, var(--ag-cyan) 6%, transparent)",
          borderColor: "color-mix(in srgb, var(--ag-cyan) 22%, transparent)",
        }}
      >
        <div className="flex items-center gap-2 ag-text-title mb-3" style={{ color: "var(--ag-cyan)" }}>
          <CoolIcon name="data" tone="primary" size={18} />
          Executive summary
        </div>
        <p className="ag-text-nav leading-relaxed text-[var(--ag-text)]">{analysis.executiveSummary}</p>
        <p className="ag-text-meta mt-3 opacity-70">Model: {analysis.modelUsed}</p>
      </div>

      {analysis.topRisks.length > 0 && (
        <div className="ag-card p-5">
          <div className="flex items-center gap-2 ag-text-title mb-4" style={{ color: "var(--ag-warning)" }}>
            <CoolIcon name="trending-up" tone="warning" size={18} />
            Top risks
          </div>
          <div className="space-y-3">
            {analysis.topRisks.map((risk, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="ag-text-meta font-bold mt-0.5 w-4 shrink-0 tabular-nums">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded ag-text-meta font-bold border shrink-0 ${severityColor(risk.severity)}`}
                    >
                      {risk.severity}
                    </span>
                    <span className="ag-text-title font-medium">{risk.title}</span>
                    {risk.cveId && (
                      <span className="ag-text-meta font-mono">{risk.cveId}</span>
                    )}
                  </div>
                  <p className="ag-text-meta mt-1" style={{ color: "var(--ag-cyan)" }}>
                    AI risk score: {Number(risk.aiRiskScore).toFixed(1)} / 10
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.prioritizedFindingsMd && (
        <div className="ag-card p-5">
          <p className="ag-text-label mb-3">Full AI report</p>
          <pre className="ag-text-nav whitespace-pre-wrap font-sans leading-relaxed text-[var(--ag-text)]">
            {analysis.prioritizedFindingsMd}
          </pre>
        </div>
      )}
    </div>
  );
}
