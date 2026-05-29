"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { settingsApi, NotificationConfig } from "@/lib/api";
import {
  Settings, CheckCircle2, Bell, Trash2, Plus,
  Save, RefreshCw, AlertCircle, ExternalLink, Info, Send,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

const SEVERITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export default function SettingsPage() {
  const { data: session } = useSession();

  // Discord webhook state
  const [configs, setConfigs]       = useState<NotificationConfig[]>([]);
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [minSeverity, setMinSeverity] = useState("HIGH");
  const [enabled, setEnabled]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saveOk, setSaveOk]         = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    settingsApi
      .listNotifications()
      .then((data) => {
        setConfigs(data);
        const discord = data.find((c) => c.channelType === "DISCORD");
        if (discord) {
          setMinSeverity(discord.minSeverity);
          setEnabled(discord.enabled);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingCfg(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.startsWith("https://discord.com/api/webhooks/") &&
        !webhookUrl.startsWith("https://discordapp.com/api/webhooks/")) {
      setSaveError("URL must start with https://discord.com/api/webhooks/");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const updated = await settingsApi.saveNotification({ webhookUrl, minSeverity, enabled });
      setConfigs((prev) => {
        const exists = prev.find((c) => c.id === updated.id);
        return exists ? prev.map((c) => (c.id === updated.id ? updated : c)) : [...prev, updated];
      });
      setWebhookUrl("");
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message ?? "Failed to save webhook. Check the URL.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setDeleteError(null);
    try {
      await settingsApi.deleteNotification(id);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to delete webhook";
      setDeleteError(msg);
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await settingsApi.testWebhook();
      setTestResult({ ok: res.success, msg: res.message });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Test request failed";
      setTestResult({ ok: false, msg });
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 6000);
    }
  };

  const existingDiscord = configs.find((c) => c.channelType === "DISCORD");

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-3 pb-1">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
        >
          <Settings className="h-4 w-4" style={{ color: "#818cf8" }} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white leading-none">Settings</h1>
          <p className="text-[11px] mt-0.5" style={{ color: "#8b949e" }}>
            Manage integrations and notification preferences
          </p>
        </div>
      </div>

      {/* ── GitHub Connection ─────────────────────────────────────── */}
      <section
        className="rounded-xl overflow-hidden"
        style={{ background: "#161b22", border: "1px solid #30363d" }}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #30363d" }}>
          <div className="flex items-center gap-2">
            <GithubIcon className="h-4 w-4" style={{ color: "#c9d1d9" }} />
            <h2 className="text-sm font-semibold text-white">GitHub Connection</h2>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
            Required for scanning repositories and accessing your code.
          </p>
        </div>
        <div className="px-5 py-4">
          {session?.user ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt="avatar"
                    className="h-9 w-9 rounded-full"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{session.user.name}</p>
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(63,185,80,0.12)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.25)" }}
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "#6e7681" }}>{session.user.email}</p>
                </div>
              </div>
              <button
                onClick={() => signIn("github", { callbackUrl: "/settings" })}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors"
                style={{ background: "#0d1117", border: "1px solid #30363d", color: "#8b949e" }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Re-authorize
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm" style={{ color: "#8b949e" }}>
                <AlertCircle className="h-4 w-4" style={{ color: "#e3b341" }} />
                Not connected to GitHub
              </div>
              <button
                onClick={() => signIn("github", { callbackUrl: "/settings" })}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ background: "#6366f1" }}
              >
                <GithubIcon className="h-4 w-4" /> Connect GitHub
              </button>
            </div>
          )}
        </div>
        <div className="px-5 py-3 flex items-start gap-2" style={{ background: "#0d1117", borderTop: "1px solid #30363d" }}>
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "#6e7681" }} />
          <p className="text-[11px]" style={{ color: "#6e7681" }}>
            AgentGuard uses your GitHub OAuth token to clone and scan repositories.
            The token is encrypted at rest and never shared.
          </p>
        </div>
      </section>

      {/* ── Discord Webhook ──────────────────────────────────────── */}
      <section
        className="rounded-xl overflow-hidden"
        style={{ background: "#161b22", border: "1px solid #30363d" }}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #30363d" }}>
          <div className="flex items-center gap-2">
            {/* Discord icon */}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#818cf8">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.054a19.924 19.924 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <h2 className="text-sm font-semibold text-white">Discord Webhook</h2>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
            Receive security alerts in your Discord channel when scans find vulnerabilities.
          </p>
        </div>

        {/* Existing config */}
        {!loadingCfg && existingDiscord && (
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #30363d" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "#6e7681" }}>
              Active Webhook
            </p>
            <div
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
              style={{ background: "#0d1117", border: "1px solid #21262d" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="h-3.5 w-3.5 shrink-0" style={{ color: "#818cf8" }} />
                <span className="text-xs font-mono truncate" style={{ color: "#c9d1d9" }}>
                  {existingDiscord.webhookUrlMasked}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                  style={
                    existingDiscord.enabled
                      ? { background: "rgba(63,185,80,0.12)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.25)" }
                      : { background: "rgba(139,148,158,0.10)", color: "#8b949e", border: "1px solid #30363d" }
                  }
                >
                  {existingDiscord.enabled ? "Active" : "Disabled"}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: "rgba(99,102,241,0.10)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}
                >
                  Min: {existingDiscord.minSeverity}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  title="Send test message to Discord"
                  className="p-1.5 rounded transition-colors hover:text-indigo-400 disabled:opacity-40"
                  style={{ color: "#6e7681" }}
                >
                  {testing
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />
                  }
                </button>
                <button
                  onClick={() => handleDelete(existingDiscord.id)}
                  disabled={deleting === existingDiscord.id}
                  title="Delete webhook"
                  className="p-1.5 rounded transition-colors hover:text-red-400 disabled:opacity-40"
                  style={{ color: "#6e7681" }}
                >
                  {deleting === existingDiscord.id
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            </div>

            {/* Feedback messages */}
            {deleteError && (
              <p className="mt-2 text-xs flex items-center gap-1.5" style={{ color: "#f85149" }}>
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {deleteError}
              </p>
            )}
            {testResult && (
              <p className="mt-2 text-xs flex items-center gap-1.5"
                 style={{ color: testResult.ok ? "#3fb950" : "#f85149" }}>
                {testResult.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  : <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                }
                {testResult.msg}
              </p>
            )}
          </div>
        )}

        {/* Add / Update form */}
        <form onSubmit={handleSave} className="px-5 py-4 space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6e7681" }}>
            {existingDiscord ? "Update Webhook" : "Add Webhook"}
          </p>

          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: "#8b949e" }}>Webhook URL</label>
            <input
              required
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ background: "#0d1117", border: "1px solid #30363d" }}
            />
            <p className="text-[10px]" style={{ color: "#6e7681" }}>
              In Discord: channel settings → Integrations → Webhooks → Copy Webhook URL
              <a
                href="https://support.discord.com/hc/en-us/articles/228383668"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 inline-flex items-center gap-0.5 hover:text-indigo-400"
                style={{ color: "#818cf8" }}
              >
                Guide <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: "#8b949e" }}>Minimum Severity</label>
              <select
                value={minSeverity}
                onChange={(e) => setMinSeverity(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                style={{ background: "#0d1117", border: "1px solid #30363d" }}
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: "#8b949e" }}>Status</label>
              <select
                value={enabled ? "true" : "false"}
                onChange={(e) => setEnabled(e.target.value === "true")}
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                style={{ background: "#0d1117", border: "1px solid #30363d" }}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>

          {saveError && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: "#f85149" }}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {saveError}
            </p>
          )}
          {saveOk && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: "#3fb950" }}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Webhook saved successfully
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !webhookUrl}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "#6366f1" }}
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : existingDiscord ? (
              <Save className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {saving ? "Saving…" : existingDiscord ? "Update Webhook" : "Add Webhook"}
          </button>
        </form>
      </section>
    </div>
  );
}
