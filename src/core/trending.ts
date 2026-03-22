import { searchRepos } from './github.js';
import { logger } from '../utils/logger.js';
import type { RepoInfo } from '../types/github.js';

// ── Cache (1-hour TTL) ──────────────────────────────────────

const trendingCache = new Map<string, { data: RepoInfo[]; expiry: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── Date helpers ────────────────────────────────────────────

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ── Public API ──────────────────────────────────────────────

export async function getTrending(options: {
  since?: 'daily' | 'weekly' | 'monthly';
  language?: string;
  limit?: number;
}): Promise<RepoInfo[]> {
  const since = options.since ?? 'daily';
  const limit = options.limit ?? 12;
  const language = options.language;

  const cacheKey = `${since}:${language ?? ''}:${limit}`;
  const cached = trendingCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  trendingCache.delete(cacheKey);

  // Build query based on period
  let dateStr: string;
  let minStars: number;

  switch (since) {
    case 'weekly':
      dateStr = dateDaysAgo(7);
      minStars = 50;
      break;
    case 'monthly':
      dateStr = dateDaysAgo(30);
      minStars = 100;
      break;
    case 'daily':
    default:
      dateStr = dateDaysAgo(1);
      minStars = 10;
      break;
  }

  const query = `created:>${dateStr} stars:>${minStars}`;

  try {
    const result = await searchRepos(query, { language, limit });
    trendingCache.set(cacheKey, { data: result.repos, expiry: Date.now() + CACHE_TTL });
    return result.repos;
  } catch (err) {
    logger.warn('Failed to fetch trending repos:', err);
    return [];
  }
}
