export interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  license: string | null;
  topics: string[];
  defaultBranch: string;
  updatedAt: string;
  homepage: string | null;
  isArchived: boolean;
}

export interface App {
  id: string;
  owner: string;
  repo: string;
  fullName: string;
  alias: string | null;
  description: string | null;
  runtime: string;
  startCommand: string;
  port: number | null;
  status: 'installing' | 'installed' | 'running' | 'stopped' | 'error';
  pid: number | null;
  installPath: string;
  stars: number;
  language: string | null;
  license: string | null;
  installedAt: string;
  updatedAt: string | null;
}

export interface DetectionResult {
  primaryRuntime: string;
  alternativeRuntimes: string[];
  confidence: string;
  manifest: string;
  installCommand: string;
  buildCommand: string | null;
  startCommand: string;
  detectedPort: number | null;
  runtimeVersion: string | null;
  envVarsRequired: string[];
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  score: number;
  reasons: string[];
  hasPostinstallScripts: boolean;
  hasDockerfile: boolean;
}

export interface InspectResult {
  repo: RepoInfo;
  detection: DetectionResult | null;
  prerequisites: { met: boolean; missing: string[]; available: string[] } | null;
  risk: RiskAssessment | null;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error: string }).error ?? 'Request failed');
  return data as T;
}

export const api = {
  search(query: string, opts?: { language?: string; minStars?: number; topic?: string; limit?: number }) {
    const params = new URLSearchParams({ q: query });
    if (opts?.language) params.set('language', opts.language);
    if (opts?.minStars) params.set('minStars', String(opts.minStars));
    if (opts?.topic) params.set('topic', opts.topic);
    if (opts?.limit) params.set('limit', String(opts.limit));
    return apiFetch<{ repos: RepoInfo[]; totalCount: number }>(`/api/search?${params}`);
  },

  inspect(owner: string, repo: string) {
    return apiFetch<InspectResult>(`/api/inspect/${owner}/${repo}`);
  },

  listApps(status?: string) {
    const params = status ? `?status=${status}` : '';
    return apiFetch<{ apps: App[] }>(`/api/apps${params}`);
  },

  getApp(id: string) {
    return apiFetch<App>(`/api/apps/${id}`);
  },

  install(repo: string, alias?: string) {
    return apiFetch<{ app: App; message: string }>('/api/apps/install', {
      method: 'POST',
      body: JSON.stringify({ repo, alias }),
    });
  },

  start(id: string, port?: number, env?: Record<string, string>) {
    return apiFetch<App>(`/api/apps/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({ port, env }),
    });
  },

  stop(id: string) {
    return apiFetch<App>(`/api/apps/${id}/stop`, { method: 'POST' });
  },

  restart(id: string) {
    return apiFetch<App>(`/api/apps/${id}/restart`, { method: 'POST' });
  },

  update(id: string) {
    return apiFetch<App>(`/api/apps/${id}/update`, { method: 'POST' });
  },

  uninstall(id: string) {
    return apiFetch<{ success: boolean }>(`/api/apps/${id}`, { method: 'DELETE' });
  },

  getLogs(id: string, lines?: number) {
    const params = lines ? `?lines=${lines}` : '';
    return apiFetch<{ app: string; logs: string }>(`/api/logs/${id}${params}`);
  },
};
