import type { RepoInfo, SearchResult, RepoFile } from '../types/github.js';
import { getGithubToken } from './config.js';
import { logger } from '../utils/logger.js';

// ── GitHub REST API client ─────────────────────────────────

interface GitHubFetchResult<T> {
  data: T;
  headers: Headers;
}

async function githubFetchRaw<T = unknown>(endpoint: string): Promise<GitHubFetchResult<T>> {
  const token = getGithubToken();
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'GitStore/0.1.0',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`https://api.github.com${endpoint}`, { headers });

  if (!res.ok) {
    // Rate limit detection
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (res.status === 403 && remaining === '0') {
      const reset = res.headers.get('x-ratelimit-reset');
      const resetAt = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : 'soon';
      throw new Error(
        `GitHub API rate limit exceeded. Resets at ${resetAt}. ` +
        `Add a personal access token in Settings for 5,000 requests/hour.`
      );
    }
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`GitHub API ${res.status}: ${body.message ?? res.statusText}`);
  }

  const data = await res.json() as T;
  return { data, headers: res.headers };
}

async function githubFetch<T = unknown>(endpoint: string): Promise<T> {
  const result = await githubFetchRaw<T>(endpoint);
  return result.data;
}

// ── Parsers ────────────────────────────────────────────────

interface GitHubSearchItem {
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  license: { spdx_id: string; name: string } | null;
  topics: string[];
  default_branch: string;
  updated_at: string;
  created_at: string;
  homepage: string | null;
  archived: boolean;
  open_issues_count: number;
}

function parseRepo(raw: GitHubSearchItem): RepoInfo {
  const [owner, name] = raw.full_name.split('/');
  return {
    owner,
    name,
    fullName: raw.full_name,
    description: raw.description,
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    language: raw.language,
    license: raw.license?.spdx_id ?? raw.license?.name ?? null,
    topics: raw.topics ?? [],
    defaultBranch: raw.default_branch ?? 'main',
    updatedAt: raw.updated_at ?? '',
    createdAt: raw.created_at ?? '',
    homepage: raw.homepage,
    isArchived: raw.archived ?? false,
    openIssues: raw.open_issues_count ?? 0,
  };
}

// ── Public API ─────────────────────────────────────────────

export async function searchRepos(
  query: string,
  options: { language?: string; minStars?: number; topic?: string; limit?: number } = {}
): Promise<SearchResult> {
  const limit = options.limit ?? 10;

  let q = query;
  if (options.language) q += ` language:${options.language}`;
  if (options.minStars) q += ` stars:>=${options.minStars}`;
  if (options.topic) q += ` topic:${options.topic}`;

  const params = new URLSearchParams({
    q,
    sort: 'stars',
    order: 'desc',
    per_page: String(limit),
  });

  const data = await githubFetch<{ total_count: number; items: GitHubSearchItem[] }>(
    `/search/repositories?${params}`
  );

  return {
    repos: data.items.map(parseRepo),
    totalCount: data.total_count,
  };
}

export async function getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const raw = await githubFetch<GitHubSearchItem>(`/repos/${owner}/${repo}`);
  return parseRepo(raw);
}

export async function getRepoFiles(owner: string, repo: string, path: string = ''): Promise<RepoFile[]> {
  const items = await githubFetch<Array<{ name: string; path: string; type: string }>>(
    `/repos/${owner}/${repo}/contents/${path}`
  );

  return items.map(item => ({
    name: item.name,
    path: item.path,
    type: item.type as 'file' | 'dir',
  }));
}

export async function getFileContent(owner: string, repo: string, filePath: string): Promise<string> {
  const data = await githubFetch<{ content: string; encoding: string }>(
    `/repos/${owner}/${repo}/contents/${filePath}`
  );

  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export async function getReadme(owner: string, repo: string): Promise<string> {
  try {
    const data = await githubFetch<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/readme`
    );
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/** Render markdown to HTML using GitHub's rendering API */
export async function renderMarkdown(text: string, context: string): Promise<string> {
  const token = getGithubToken();
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'GitStore/0.1.0',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('https://api.github.com/markdown', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, mode: 'gfm', context }),
  });

  if (!res.ok) return '';
  return res.text();
}

/** Get GitHub API rate limit status */
export async function getRateLimit(): Promise<{ remaining: number; limit: number; reset: number }> {
  const data = await githubFetch<{ rate: { remaining: number; limit: number; reset: number } }>(
    '/rate_limit'
  );
  return data.rate;
}

export async function getStarredRepos(page = 1, perPage = 30): Promise<{ repos: RepoInfo[]; hasMore: boolean }> {
  const token = getGithubToken();
  if (!token) {
    throw new Error('A GitHub personal access token is required to view starred repos. Add one in Settings.');
  }

  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    sort: 'created',
    direction: 'desc',
  });

  const { data, headers } = await githubFetchRaw<GitHubSearchItem[]>(
    `/user/starred?${params}`
  );

  const repos = data.map(parseRepo);

  // Check Link header for rel="next" to determine if there are more pages
  const linkHeader = headers.get('link') ?? '';
  const hasMore = linkHeader.includes('rel="next"');

  return { repos, hasMore };
}

export async function getAuthenticatedUser(): Promise<{ login: string; avatarUrl: string; name: string | null } | null> {
  const token = getGithubToken();
  if (!token) return null;

  try {
    const data = await githubFetch<{ login: string; avatar_url: string; name: string | null }>('/user');
    return {
      login: data.login,
      avatarUrl: data.avatar_url,
      name: data.name,
    };
  } catch {
    return null;
  }
}

export function parseRepoString(input: string): { owner: string; repo: string } {
  const urlMatch = input.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') };
  }

  const parts = input.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }

  throw new Error(`Invalid repo format: "${input}". Use owner/repo or a GitHub URL.`);
}
