"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { settingsApi, NotificationConfig } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoolIcon } from "@/components/icons/CoolIcon";

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

  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [minSeverity, setMinSeverity] = useState("HIGH");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
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
    if (
      !webhookUrl.startsWith("https://discord.com/api/webhooks/") &&
      !webhookUrl.startsWith("https://discordapp.com/api/webhooks/")
    ) {
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
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to save webhook. Check the URL.";
      setSaveError(msg);
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
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Failed to delete webhook";
      setDeleteError(msg);
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
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Test request failed";
      setTestResult({ ok: false, msg });
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 6000);
    }
  };

  const existingDiscord = configs.find((c) => c.channelType === "DISCORD");

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader
        icon="settings"
        tone="primary"
        title="Settings"
        subtitle="Manage integrations and notification preferences"
      />

      <section className="ag-card overflow-hidden p-0">
        <div className="px-5 py-4 border-b ag-divider">
          <div className="flex items-center gap-2">
            <GithubIcon className="h-4 w-4 text-[var(--ag-text)]" />
            <h2 className="ag-text-section">GitHub connection</h2>
          </div>
          <p className="ag-text-meta mt-1">Required for scanning repositories and accessing your code.</p>
        </div>
        <div className="px-5 py-4">
          {session?.user ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="avatar" className="h-9 w-9 rounded-full" />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="ag-text-title">{session.user.name}</p>
                    <span
                      className="inline-flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        fontSize: "var(--ag-text-label)",
                        background: "color-mix(in srgb, var(--ag-safe) 12%, transparent)",
                        color: "var(--ag-safe)",
                        border: "1px solid color-mix(in srgb, var(--ag-safe) 28%, transparent)",
                      }}
                    >
                      <CoolIcon name="shield-check" tone="safe" size={11} />
                      Connected
                    </span>
                  </div>
                  <p className="ag-text-meta mt-0.5">{session.user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signIn("github", { callbackUrl: "/settings" })}
                className="ag-btn-secondary"
              >
                <CoolIcon name="chevron-down" tone="muted" size={14} className="rotate-180" />
                Re-authorize
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 ag-text-nav text-[var(--ag-text-muted)]">
                <CoolIcon name="warning" tone="warning" size={16} />
                Not connected to GitHub
              </div>
              <button
                type="button"
                onClick={() => signIn("github", { callbackUrl: "/settings" })}
                className="ag-btn-primary"
              >
                <GithubIcon className="h-4 w-4" />
                Connect GitHub
              </button>
            </div>
          )}
        </div>
        <div
          className="px-5 py-3 flex items-start gap-2 border-t ag-divider"
          style={{ background: "var(--ag-bg)" }}
        >
          <CoolIcon name="shield" tone="muted" size={14} className="mt-0.5 shrink-0" />
          <p className="ag-text-body">
            AgentGuard uses your GitHub OAuth token to clone and scan repositories. The token is
            encrypted at rest and never shared.
          </p>
        </div>
      </section>

      <section className="ag-card overflow-hidden p-0">
        <div className="px-5 py-4 border-b ag-divider">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#818cf8">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.054a19.924 19.924 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            <h2 className="ag-text-section">Discord webhook</h2>
          </div>
          <p className="ag-text-meta mt-1">
            Receive security alerts in your Discord channel when scans find vulnerabilities.
          </p>
        </div>

        {!loadingCfg && existingDiscord && (
          <div className="px-5 py-4 border-b ag-divider">
            <p className="ag-text-label mb-3">Active webhook</p>
            <div
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
              style={{ background: "var(--ag-bg)", border: "1px solid var(--ag-border)" }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <CoolIcon name="bell" tone="primary" size={14} className="shrink-0" />
                <span className="ag-text-meta font-mono truncate">{existingDiscord.webhookUrlMasked}</span>
                <span
                  className="font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    fontSize: "var(--ag-text-label)",
                    ...(existingDiscord.enabled
                      ? {
                          background: "color-mix(in srgb, var(--ag-safe) 12%, transparent)",
                          color: "var(--ag-safe)",
                          border: "1px solid color-mix(in srgb, var(--ag-safe) 28%, transparent)",
                        }
                      : {
                          background: "color-mix(in srgb, var(--ag-neutral) 8%, transparent)",
                          color: "var(--ag-text-muted)",
                          border: "1px solid var(--ag-border)",
                        }),
                  }}
                >
                  {existingDiscord.enabled ? "Active" : "Disabled"}
                </span>
                <span
                  className="font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    fontSize: "var(--ag-text-label)",
                    background: "color-mix(in srgb, var(--ag-cyan) 10%, transparent)",
                    color: "var(--ag-cyan)",
                    border: "1px solid color-mix(in srgb, var(--ag-cyan) 22%, transparent)",
                  }}
                >
                  Min: {existingDiscord.minSeverity}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  title="Send test message"
                  className="p-1.5 rounded transition-opacity hover:opacity-80 disabled:opacity-40 text-[var(--ag-text-muted)]"
                >
                  {testing ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent animate-spin ag-spinner" />
                  ) : (
                    <CoolIcon name="play" tone="primary" size={14} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(existingDiscord.id)}
                  disabled={deleting === existingDiscord.id}
                  title="Delete webhook"
                  className="p-1.5 rounded transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {deleting === existingDiscord.id ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent animate-spin ag-spinner" />
                  ) : (
                    <CoolIcon name="trash" tone="danger" size={14} />
                  )}
                </button>
              </div>
            </div>

            {deleteError && (
              <p className="mt-2 ag-text-body flex items-center gap-1.5" style={{ color: "var(--ag-danger)" }}>
                <CoolIcon name="warning" tone="danger" size={14} />
                {deleteError}
              </p>
            )}
            {testResult && (
              <p
                className="mt-2 ag-text-body flex items-center gap-1.5"
                style={{ color: testResult.ok ? "var(--ag-safe)" : "var(--ag-danger)" }}
              >
                <CoolIcon
                  name={testResult.ok ? "shield-check" : "warning"}
                  tone={testResult.ok ? "safe" : "danger"}
                  size={14}
                />
                {testResult.msg}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSave} className="px-5 py-4 space-y-4">
          <p className="ag-text-label">{existingDiscord ? "Update webhook" : "Add webhook"}</p>

          <div className="space-y-1.5">
            <label className="ag-text-meta">Webhook URL</label>
            <input
              required
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              className="w-full rounded-lg px-3 py-2 ag-text-nav text-white outline-none ag-input focus:ring-1 focus:ring-[var(--ag-cyan)]"
            />
            <p className="ag-text-body">
              Discord: channel settings → Integrations → Webhooks → Copy URL.{" "}
              <a
                href="https://support.discord.com/hc/en-us/articles/228383668"
                target="_blank"
                rel="noopener noreferrer"
                className="ag-text-link inline-flex items-center gap-0.5"
              >
                Guide
                <CoolIcon name="chevron-down" tone="primary" size={12} className="rotate-[-90deg]" />
              </a>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="ag-text-meta">Minimum severity</label>
              <select
                value={minSeverity}
                onChange={(e) => setMinSeverity(e.target.value)}
                className="w-full rounded-lg px-3 py-2 ag-text-nav text-white outline-none ag-input"
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="ag-text-meta">Status</label>
              <select
                value={enabled ? "true" : "false"}
                onChange={(e) => setEnabled(e.target.value === "true")}
                className="w-full rounded-lg px-3 py-2 ag-text-nav text-white outline-none ag-input"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>

          {saveError && (
            <p className="ag-text-body flex items-center gap-1.5" style={{ color: "var(--ag-danger)" }}>
              <CoolIcon name="warning" tone="danger" size={14} />
              {saveError}
            </p>
          )}
          {saveOk && (
            <p className="ag-text-body flex items-center gap-1.5" style={{ color: "var(--ag-safe)" }}>
              <CoolIcon name="shield-check" tone="safe" size={14} />
              Webhook saved successfully
            </p>
          )}

          <button type="submit" disabled={saving || !webhookUrl} className="ag-btn-primary">
            {saving ? (
              <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin border-[#0a0c10]" />
            ) : (
              <CoolIcon
                name={existingDiscord ? "shield-check" : "plus"}
                tone="default"
                size={16}
                className="!text-[#0a0c10]"
              />
            )}
            {saving ? "Saving…" : existingDiscord ? "Update webhook" : "Add webhook"}
          </button>
        </form>
      </section>
    </div>
  );
}
