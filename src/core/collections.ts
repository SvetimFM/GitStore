import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRepoInfo } from './github.js';
import { logger } from '../utils/logger.js';
import type {
  Category,
  Collection,
  FeaturedApp,
  EnrichedCollection,
  EnrichedFeatured,
} from '../types/collections.js';
import type { RepoInfo } from '../types/github.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface CollectionsData {
  version: number;
  categories: Category[];
  collections: Collection[];
  featured: FeaturedApp[];
}

let data: CollectionsData | null = null;

function getData(): CollectionsData {
  if (!data) {
    try {
      const raw = readFileSync(join(__dirname, '../data/collections.json'), 'utf-8');
      data = JSON.parse(raw) as CollectionsData;
    } catch (err) {
      logger.warn('Failed to load collections.json, using empty defaults', err);
      data = { version: 1, categories: [], collections: [], featured: [] };
    }
  }
  return data;
}

// Cache for enriched repo info (10-minute TTL)
const repoCache = new Map<string, { data: RepoInfo; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000;

async function getCachedRepoInfo(fullName: string): Promise<RepoInfo | null> {
  const cached = repoCache.get(fullName);
  if (cached) {
    if (cached.expiry > Date.now()) return cached.data;
    repoCache.delete(fullName); // evict expired entry
  }
  try {
    const [owner, repo] = fullName.split('/');
    const info = await getRepoInfo(owner, repo);
    repoCache.set(fullName, { data: info, expiry: Date.now() + CACHE_TTL });
    return info;
  } catch (err) {
    logger.warn(`Failed to fetch repo info for ${fullName}:`, err);
    return null;
  }
}

export function getCategories(): Category[] {
  return getData().categories;
}

export function getCollections(categoryId?: string): Collection[] {
  const d = getData();
  if (categoryId) {
    return d.collections.filter(c => c.categoryId === categoryId);
  }
  return d.collections;
}

export function getCollection(id: string): Collection | undefined {
  return getData().collections.find(c => c.id === id);
}

export function getFeatured(): FeaturedApp[] {
  return getData().featured;
}

export async function enrichCollectionRepos(collection: Collection): Promise<EnrichedCollection> {
  const enrichedRepos = await Promise.all(
    collection.repos.map(async (repo) => ({
      fullName: repo.fullName,
      note: repo.note,
      info: await getCachedRepoInfo(repo.fullName),
    }))
  );
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    categoryId: collection.categoryId,
    repos: enrichedRepos,
  };
}

export async function enrichFeatured(): Promise<EnrichedFeatured[]> {
  return Promise.all(
    getData().featured.map(async (app) => ({
      fullName: app.fullName,
      tagline: app.tagline,
      info: await getCachedRepoInfo(app.fullName),
    }))
  );
}
