export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type ScanStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type TargetType = "GIT_REPO" | "DOCKER_IMAGE";

export type VulnStatus = "OPEN" | "ACKNOWLEDGED" | "SUPPRESSED" | "FIXED";

export type VulnCategory =
  | "CVE"
  | "SECRET"
  | "IAC_MISCONFIG"
  | "DEPENDENCY"
  | "K8S_SECURITY"
  | "SAST";

export interface User {
  id: string;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface Repository {
  id: string;
  targetType: TargetType;
  githubRepoFullName: string | null;
  dockerImage: string | null;
  defaultBranch: string;
  lastScannedAt: string | null;
  createdAt: string;
}

export type ToolRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface ScanToolRun {
  id: string;
  toolName: string;
  status: ToolRunStatus;
  durationMs: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Scan {
  id: string;
  repository: Repository;
  status: ScanStatus;
  commitSha: string | null;
  branch: string | null;
  detectedTechStacks: string[];
  totalCritical: number;
  totalHigh: number;
  totalMedium: number;
  totalLow: number;
  totalInfo: number;
  securityScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Vulnerability {
  id: string;
  toolSource: string;
  cveId: string | null;
  title: string;
  description: string | null;
  severity: Severity;
  category: VulnCategory;
  affectedComponent: string | null;
  affectedVersion: string | null;
  fixedVersion: string | null;
  filePath: string | null;
  lineNumber: number | null;
  cvssScore: number | null;
  aiRiskScore: number | null;
  aiExplanation: string | null;
  aiRemediation: string | null;
  status: VulnStatus;
  createdAt: string;
}

export interface AiAnalysis {
  id: string;
  executiveSummary: string;
  prioritizedFindingsMd: string;
  topRisks: TopRisk[];
  modelUsed: string;
  createdAt: string;
}

export interface TopRisk {
  title: string;
  severity: Severity;
  aiRiskScore: number;
  cveId: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
