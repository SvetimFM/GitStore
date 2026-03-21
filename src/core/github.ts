import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RepoInfo, SearchResult, RepoFile } from '../types/github.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

async function gh(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('gh', args, {
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`gh CLI failed: ${msg}`);
  }
}

/**
 * Parse search results from `gh search repos`.
 * Field names: name, owner, fullName, description, stargazersCount,
 * forksCount, language, license, updatedAt, createdAt, isArchived,
 * defaultBranch, homepage
 */
function parseSearchResult(raw: Record<string, unknown>): RepoInfo {
  const owner = raw.owner as Record<string, unknown>;
  return {
    owner: owner?.login as string ?? '',
    name: raw.name as string,
    fullName: raw.fullName as string ?? `${owner?.login}/${raw.name}`,
    description: (raw.description as string) ?? null,
    stars: (raw.stargazersCount ?? 0) as number,
    forks: (raw.forksCount ?? 0) as number,
    language: (raw.language as string) ?? null,
    license: (raw.license as Record<string, unknown>)?.key as string ?? (raw.license as string) ?? null,
    topics: [],  // not available in search results
    defaultBranch: (raw.defaultBranch as string) ?? 'main',
    updatedAt: (raw.updatedAt as string) ?? '',
    createdAt: (raw.createdAt as string) ?? '',
    homepage: (raw.homepage as string) ?? null,
    isArchived: (raw.isArchived ?? false) as boolean,
    openIssues: 0,
  };
}

/**
 * Parse repo view from `gh repo view`.
 * Field names: name, owner, description, stargazerCount, forkCount,
 * primaryLanguage, licenseInfo, updatedAt, createdAt, isArchived,
 * defaultBranchRef, repositoryTopics, homepageUrl, issues
 */
function parseRepoView(raw: Record<string, unknown>): RepoInfo {
  const owner = raw.owner as Record<string, unknown>;
  const primaryLang = raw.primaryLanguage as Record<string, unknown> | null;
  const licenseInfo = raw.licenseInfo as Record<string, unknown> | null;
  const defaultBranch = raw.defaultBranchRef as Record<string, unknown> | null;
  const topicNodes = (raw.repositoryTopics as Record<string, unknown>)?.nodes as Array<Record<string, unknown>> | undefined;

  return {
    owner: owner?.login as string ?? '',
    name: raw.name as string,
    fullName: (raw.nameWithOwner as string) ?? `${owner?.login}/${raw.name}`,
    description: (raw.description as string) ?? null,
    stars: (raw.stargazerCount ?? 0) as number,
    forks: (raw.forkCount ?? 0) as number,
    language: primaryLang?.name as string ?? null,
    license: licenseInfo?.name as string ?? null,
    topics: topicNodes?.map(n => (n.topic as Record<string, unknown>)?.name as string).filter(Boolean) ?? [],
    defaultBranch: defaultBranch?.name as string ?? 'main',
    updatedAt: (raw.updatedAt as string) ?? '',
    createdAt: (raw.createdAt as string) ?? '',
    homepage: (raw.homepageUrl as string) ?? null,
    isArchived: (raw.isArchived ?? false) as boolean,
    openIssues: (raw.issues as Record<string, unknown>)?.totalCount as number ?? 0,
  };
}

export async function searchRepos(
  query: string,
  options: { language?: string; minStars?: number; topic?: string; limit?: number } = {}
): Promise<SearchResult> {
  const limit = options.limit ?? 10;

  let searchQuery = query;
  if (options.language) searchQuery += ` language:${options.language}`;
  if (options.minStars) searchQuery += ` stars:>=${options.minStars}`;
  if (options.topic) searchQuery += ` topic:${options.topic}`;

  const output = await gh([
    'search', 'repos', searchQuery,
    '--limit', String(limit),
    '--json', 'name,owner,description,stargazersCount,forksCount,language,license,updatedAt,createdAt,isArchived,defaultBranch,fullName,homepage',
  ]);

  const raw = JSON.parse(output) as Array<Record<string, unknown>>;
  const repos = raw.map(parseSearchResult);

  return { repos, totalCount: repos.length };
}

export async function getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const output = await gh([
    'repo', 'view', `${owner}/${repo}`,
    '--json', 'name,owner,description,stargazerCount,forkCount,primaryLanguage,licenseInfo,updatedAt,createdAt,isArchived,defaultBranchRef,repositoryTopics,homepageUrl,nameWithOwner,issues',
  ]);

  const raw = JSON.parse(output) as Record<string, unknown>;
  return parseRepoView(raw);
}

export async function getRepoFiles(owner: string, repo: string, path: string = ''): Promise<RepoFile[]> {
  const output = await gh([
    'api', `repos/${owner}/${repo}/contents/${path}`,
    '--jq', '.[] | {name: .name, path: .path, type: .type}',
  ]);

  const files: RepoFile[] = [];
  for (const line of output.trim().split('\n')) {
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as RepoFile;
      files.push(parsed);
    } catch {
      logger.debug('Failed to parse file listing line:', line);
    }
  }
  return files;
}

export async function getFileContent(owner: string, repo: string, filePath: string): Promise<string> {
  const output = await gh([
    'api', `repos/${owner}/${repo}/contents/${filePath}`,
    '--jq', '.content',
  ]);

  return Buffer.from(output.trim(), 'base64').toString('utf-8');
}

export async function getReadme(owner: string, repo: string): Promise<string> {
  try {
    const output = await gh(['repo', 'view', `${owner}/${repo}`]);
    return output;
  } catch {
    return '';
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
