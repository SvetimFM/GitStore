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
  createdAt: string;
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
  envVarsRequired: string[];
  envConfigured: boolean;
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
  prerequisites: {
    met: boolean;
    missing: string[];
    available: string[];
    fallbackDetection?: DetectionResult | null;
  } | null;
  risk: RiskAssessment | null;
}

export interface AppEnvVar {
  id: string;
  appId: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  color?: string;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  repos: Array<{ fullName: string; note?: string }>;
}

export interface EnrichedCollectionRepo {
  fullName: string;
  note?: string;
  info: RepoInfo | null;
}

export interface EnrichedCollection {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  repos: EnrichedCollectionRepo[];
}

export interface FeaturedAppInfo {
  fullName: string;
  tagline?: string;
  info: RepoInfo | null;
}

// In Tauri desktop app, API is served on port 3456.
// In browser dev mode, Vite proxies /api to the backend.
function getBaseUrl(): string {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return 'http://127.0.0.1:3456';
  }
  return '';  // relative URLs — Vite proxy or same-origin
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const base = getBaseUrl();
  const res = await fetch(`${base}${url}`, {
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

  getEnv(id: string) {
    return apiFetch<{ vars: AppEnvVar[] }>(`/api/apps/${id}/env`);
  },

  setEnv(id: string, vars: Record<string, string>, secret?: boolean) {
    return apiFetch<{ vars: AppEnvVar[] }>(`/api/apps/${id}/env`, {
      method: 'PUT',
      body: JSON.stringify({ vars, secret: secret ?? false }),
    });
  },

  deleteEnvVar(id: string, key: string) {
    return apiFetch<{ success: boolean }>(`/api/apps/${id}/env/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  },

  getCollections(categoryId?: string) {
    const params = categoryId ? `?categoryId=${categoryId}` : '';
    return apiFetch<{ categories: Category[]; collections: CollectionSummary[] }>(`/api/collections${params}`);
  },

  getFeatured() {
    return apiFetch<{ featured: FeaturedAppInfo[] }>('/api/collections/featured');
  },

  getCollection(id: string) {
    return apiFetch<EnrichedCollection>(`/api/collections/${id}`);
  },

  getCategoryDetail(id: string) {
    return apiFetch<{ category: Category; collections: CollectionSummary[] }>(`/api/collections/categories/${id}`);
  },

  getTrending(since?: 'daily' | 'weekly' | 'monthly', language?: string) {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (language) params.set('language', language);
    return apiFetch<{ repos: RepoInfo[] }>(`/api/trending?${params}`);
  },

  suggest(type: 'repo' | 'source', url: string, categoryId?: string, note?: string) {
    return apiFetch<{ suggestion: { id: string; type: string; url: string; status: string } }>('/api/suggestions', {
      method: 'POST',
      body: JSON.stringify({ type, url, categoryId, note }),
    });
  },

  getReadme(owner: string, repo: string) {
    return apiFetch<{ html: string | null }>(`/api/repos/${owner}/${repo}/readme`);
  },

  getTokenStatus() {
    return apiFetch<{ hasToken: boolean }>('/api/config/github-token');
  },

  setToken(token: string) {
    return apiFetch<{ success: boolean }>('/api/config/github-token', {
      method: 'PUT',
      body: JSON.stringify({ token }),
    });
  },

  removeToken() {
    return apiFetch<{ success: boolean }>('/api/config/github-token', { method: 'DELETE' });
  },

  getRateLimit() {
    return apiFetch<{ remaining: number; limit: number; reset: number }>('/api/config/rate-limit');
  },

  getMcpStatus() {
    return apiFetch<{ configured: boolean; configPath: string | null }>('/api/config/mcp-status');
  },

  setupMcp() {
    return apiFetch<{ success: boolean; configPath: string }>('/api/config/mcp-setup', { method: 'POST' });
  },
};
