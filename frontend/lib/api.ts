import axios from "axios";
import { getSession } from "next-auth/react";
import { PageResponse, Repository, Scan, ScanToolRun, Vulnerability, AiAnalysis } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use(async (config) => {
  const session = await getSession() as any;
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

export const authApi = {
  me: () => api.get("/api/auth/me").then((r) => r.data),
  logout: () => api.post("/api/auth/logout"),
};

export const repositoriesApi = {
  list: (): Promise<Repository[]> =>
    api.get("/api/repositories").then((r) => r.data),

  get: (id: string): Promise<Repository> =>
    api.get(`/api/repositories/${id}`).then((r) => r.data),

  create: (data: {
    targetType: string;
    githubRepoFullName?: string;
    dockerImage?: string;
    defaultBranch?: string;
  }): Promise<Repository> =>
    api.post("/api/repositories", data).then((r) => r.data),

  delete: (id: string) => api.delete(`/api/repositories/${id}`),

  detectTech: (id: string): Promise<{ techStacks: string[]; recommendedTools: string[] }> =>
    api.post(`/api/repositories/${id}/detect-tech`).then((r) => r.data),
};

export const scansApi = {
  list: (page = 0): Promise<PageResponse<Scan>> =>
    api.get(`/api/scans?page=${page}`).then((r) => r.data),

  get: (id: string): Promise<Scan> =>
    api.get(`/api/scans/${id}`).then((r) => r.data),

  toolRuns: (id: string): Promise<ScanToolRun[]> =>
    api.get(`/api/scans/${id}/tool-runs`).then((r) => r.data),

  trigger: (repositoryId: string, branch?: string, forcedTools?: string[]): Promise<Scan> =>
    api.post("/api/scans", { repositoryId, branch, forcedTools }).then((r) => r.data),

  cancel: (id: string) => api.post(`/api/scans/${id}/cancel`),
};

export const vulnerabilitiesApi = {
  list: (
    scanId: string,
    params?: { severity?: string; status?: string; page?: number; size?: number }
  ): Promise<PageResponse<Vulnerability>> =>
    api
      .get(`/api/scans/${scanId}/vulnerabilities`, { params })
      .then((r) => r.data),

  updateStatus: (scanId: string, id: string, status: string, reason?: string) =>
    api
      .patch(`/api/scans/${scanId}/vulnerabilities/${id}/status`, { status, reason })
      .then((r) => r.data),
};

export const aiApi = {
  getAnalysis: (scanId: string): Promise<AiAnalysis> =>
    api.get(`/api/scans/${scanId}/ai-analysis`).then((r) => r.data),

  explainVulnerability: (scanId: string, vulnId: string): Promise<{ explanation: string; remediation: string }> =>
    api.get(`/api/scans/${scanId}/vulnerabilities/${vulnId}/explain`).then((r) => r.data),

  retryAnalysis: (scanId: string): Promise<{ message: string }> =>
    api.post(`/api/scans/${scanId}/ai-analysis/retry`).then((r) => r.data),
};

export const githubApi = {
  repos: (): Promise<GitHubRepo[]> =>
    api.get("/api/github/repos").then((r) => r.data),
};

export interface NotificationConfig {
  id: string;
  channelType: string;
  webhookUrlMasked: string;
  minSeverity: string;
  enabled: boolean;
}

export const settingsApi = {
  me: (): Promise<{ id: string; login: string; name: string; email: string; avatarUrl: string; createdAt: string; lastLoginAt: string }> =>
    api.get("/api/settings/me").then((r) => r.data),

  listNotifications: (): Promise<NotificationConfig[]> =>
    api.get("/api/settings/notifications").then((r) => r.data),

  saveNotification: (data: { webhookUrl: string; minSeverity: string; enabled: boolean }): Promise<NotificationConfig> =>
    api.post("/api/settings/notifications", data).then((r) => r.data),

  deleteNotification: (id: string): Promise<void> =>
    api.delete(`/api/settings/notifications/${id}`),

  testWebhook: (): Promise<{ success: boolean; message: string }> =>
    api.post("/api/settings/notifications/test").then((r) => r.data),
};

export interface GitHubRepo {
  id: number;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  language: string | null;
  stargazersCount: number;
  pushedAt: string;
  htmlUrl: string;
}

export default api;
