import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFileContent } from './github.js';
import { logger } from '../utils/logger.js';
import type { Category, Collection, CollectionRepo, FeaturedApp } from '../types/collections.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTIONS_PATH = join(__dirname, '../data/collections.json');

// ── Types ──────────────────────────────────────────────────

export interface ParsedSection {
  name: string;
  repos: ParsedRepo[];
}

export interface ParsedRepo {
  fullName: string;   // owner/repo
  name: string;       // display name from markdown
  description: string;
}

export interface CurateSource {
  repo: string;              // e.g. "awesome-selfhosted/awesome-selfhosted"
  file?: string;             // defaults to "README.md"
  categoryId: string;        // which GitStore category to place collections in
  sectionFilter?: string[];  // only include these sections (empty = all)
  maxReposPerSection?: number;
  minReposPerSection?: number;
}

export interface CurateResult {
  source: string;
  sectionsFound: number;
  reposFound: number;
  collectionsCreated: number;
  collectionsUpdated: number;
}

// ── Markdown Parser ────────────────────────────────────────

const GITHUB_LINK_RE = /\[([^\]]+)\]\(https?:\/\/github\.com\/([^/\s)]+)\/([^/\s)#]+)\/?[^)]*\)/g;

/**
 * Parse an awesome-list markdown into sections with GitHub repos.
 * Handles the standard format:
 *   ## Section Name
 *   - [Name](https://github.com/owner/repo) - Description
 */
export function parseAwesomeList(markdown: string): ParsedSection[] {
  const lines = markdown.split('\n');
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;

  for (const line of lines) {
    // Detect section headers: ## markdown, <h2>, or <summary><h2>
    const headerMatch = line.match(/^#{2,3}\s+(.+)$/)
      ?? line.match(/<h[23][^>]*>\s*(.+?)\s*<\/h[23]>/)
      ?? line.match(/<summary[^>]*>\s*(?:<h[23][^>]*>)?\s*(.+?)\s*(?:<\/h[23]>)?\s*<\/summary>/);
    if (headerMatch) {
      const name = headerMatch[1]
        .replace(/<[^>]+>/g, '')                  // strip HTML tags
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // strip links in headers
        .replace(/<!--.*?-->/g, '')               // strip HTML comments
        .trim();

      if (!name) continue;

      // Skip meta sections
      const skip = ['contents', 'table of contents', 'contributing', 'license', 'footnotes',
        'disclaimer', 'anti-features', 'external links', 'see also', 'related', 'credits'];
      if (skip.some(s => name.toLowerCase().includes(s))) continue;

      if (currentSection && currentSection.repos.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { name, repos: [] };
      continue;
    }

    // Extract GitHub links from list items (- or * or numbered, at any indent)
    if (currentSection && (line.match(/^\s*[-*]/) || line.match(/^\s*\d+\./))) {
      let match: RegExpExecArray | null;
      GITHUB_LINK_RE.lastIndex = 0;
      while ((match = GITHUB_LINK_RE.exec(line)) !== null) {
        const [, linkText, owner, rawRepo] = match;
        const repo = rawRepo.replace(/\.git$/, '');
        const fullName = `${owner}/${repo}`;

        // Extract description: text after the link, often after " - "
        const afterLink = line.slice(line.indexOf(match[0]) + match[0].length);
        const descMatch = afterLink.match(/^\s*[-–—:]\s*(.+)/);
        const description = descMatch
          ? descMatch[1].replace(/`[^`]*`/g, '').trim()
          : '';

        currentSection.repos.push({
          fullName,
          name: linkText,
          description,
        });
      }
    }
  }

  // Push last section
  if (currentSection && currentSection.repos.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

// ── Fetch & Curate ─────────────────────────────────────────

/**
 * Fetch an awesome-list from GitHub and parse it into sections.
 */
export async function fetchAwesomeList(
  repoFullName: string,
  file: string = 'README.md'
): Promise<ParsedSection[]> {
  const [owner, repo] = repoFullName.split('/');
  logger.info(`Fetching ${file} from ${repoFullName}...`);
  const content = await getFileContent(owner, repo, file);
  return parseAwesomeList(content);
}

// ── Slugify ────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ── Merge into collections.json ────────────────────────────

interface CollectionsData {
  version: number;
  categories: Category[];
  collections: Collection[];
  featured: FeaturedApp[];
}

function loadCollections(): CollectionsData {
  try {
    return JSON.parse(readFileSync(COLLECTIONS_PATH, 'utf-8')) as CollectionsData;
  } catch {
    return { version: 1, categories: [], collections: [], featured: [] };
  }
}

function saveCollections(data: CollectionsData): void {
  writeFileSync(COLLECTIONS_PATH, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Merge parsed sections into collections.json under the given category.
 */
export function mergeSections(
  sections: ParsedSection[],
  categoryId: string,
  options: { maxReposPerSection?: number; dryRun?: boolean } = {}
): CurateResult {
  const maxRepos = options.maxReposPerSection ?? 6;
  const data = loadCollections();

  // Verify category exists
  if (!data.categories.some(c => c.id === categoryId)) {
    throw new Error(`Category "${categoryId}" not found in collections.json`);
  }

  // Index collections by ID for O(1) lookup
  const collectionById = new Map(data.collections.map(c => [c.id, c]));

  let created = 0;
  let updated = 0;
  let totalRepos = 0;

  for (const section of sections) {
    if (section.repos.length === 0) continue;

    const collectionId = `${categoryId}-${slugify(section.name)}`;
    const repos = section.repos.slice(0, maxRepos).map(r => ({
      fullName: r.fullName,
      note: r.description || r.name,
    }));

    totalRepos += repos.length;

    const existing = collectionById.get(collectionId);
    if (existing) {
      // Merge: add new repos that aren't already in the collection
      const existingNames = new Set(existing.repos.map(r => r.fullName));
      const newRepos = repos.filter(r => !existingNames.has(r.fullName));
      if (newRepos.length > 0) {
        existing.repos.push(...newRepos);
        // Cap at maxRepos
        existing.repos = existing.repos.slice(0, maxRepos);
        updated++;
      }
    } else {
      const newCollection: Collection = {
        id: collectionId,
        name: section.name,
        categoryId,
        description: `Curated from awesome-lists`,
        repos,
      };
      data.collections.push(newCollection);
      collectionById.set(collectionId, newCollection);
      created++;
    }
  }

  if (!options.dryRun) {
    saveCollections(data);
  }

  return {
    source: categoryId,
    sectionsFound: sections.length,
    reposFound: totalRepos,
    collectionsCreated: created,
    collectionsUpdated: updated,
  };
}

/**
 * Full curate pipeline: fetch → parse → merge.
 */
export async function curateFromSource(source: CurateSource): Promise<CurateResult> {
  const sections = await fetchAwesomeList(source.repo, source.file);

  // Apply section filter if specified
  let filtered = sections;
  if (source.sectionFilter && source.sectionFilter.length > 0) {
    const filterLower = source.sectionFilter.map(s => s.toLowerCase());
    filtered = sections.filter(s =>
      filterLower.some(f => s.name.toLowerCase().includes(f))
    );
  }

  // Filter out sections with too few repos
  const minRepos = source.minReposPerSection ?? 2;
  filtered = filtered.filter(s => s.repos.length >= minRepos);

  return mergeSections(filtered, source.categoryId, {
    maxReposPerSection: source.maxReposPerSection,
  });
}

// ── Predefined Sources ─────────────────────────────────────

export const PREDEFINED_SOURCES: CurateSource[] = [
  // Self-hosted
  {
    repo: 'awesome-selfhosted/awesome-selfhosted',
    categoryId: 'self-hosted',
    maxReposPerSection: 5,
    minReposPerSection: 3,
  },
  // CLI & TUI tools
  {
    repo: 'rothgar/awesome-tuis',
    categoryId: 'cli-tools',
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
  // Go ecosystem
  {
    repo: 'avelino/awesome-go',
    categoryId: 'dev-tools',
    sectionFilter: ['Web Frameworks', 'Command Line', 'Database', 'Testing', 'Logging', 'Networking', 'Security'],
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
  // Rust ecosystem
  {
    repo: 'rust-unofficial/awesome-rust',
    categoryId: 'dev-tools',
    sectionFilter: ['Web', 'Command-line', 'Database', 'Development tools', 'System tools', 'Network'],
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
  // Python data science
  {
    repo: 'vinta/awesome-python',
    categoryId: 'data-science',
    sectionFilter: ['Data Analysis', 'Machine Learning', 'Data Visualization', 'Science', 'Natural Language Processing'],
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
  // AI & LLM
  {
    repo: 'f/awesome-chatgpt-prompts',
    categoryId: 'ai-llm',
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
  {
    repo: 'josephmisiti/awesome-machine-learning',
    categoryId: 'ai-llm',
    sectionFilter: ['Natural Language Processing', 'General-Purpose', 'Deep Learning', 'Neural Networks', 'Frameworks'],
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
  // Security
  {
    repo: 'sbilly/awesome-security',
    categoryId: 'security',
    sectionFilter: ['Network', 'Web', 'Endpoint', 'Threat Intelligence', 'Operating Systems'],
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
  // DevOps
  {
    repo: 'bregman-arie/devops-exercises',
    categoryId: 'devops',
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
  {
    repo: 'wmariuss/awesome-devops',
    categoryId: 'devops',
    sectionFilter: ['Cloud', 'Containers', 'CI/CD', 'Monitoring', 'Infrastructure'],
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
  // Productivity
  {
    repo: 'jrgarciadev/awesome-react-nextjs',
    categoryId: 'web-frameworks',
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
  // Games
  {
    repo: 'leereilly/games',
    categoryId: 'games',
    maxReposPerSection: 5,
    minReposPerSection: 2,
  },
];

/**
 * Curate from all predefined sources.
 */
export async function curateAll(): Promise<CurateResult[]> {
  const results: CurateResult[] = [];
  for (const source of PREDEFINED_SOURCES) {
    try {
      logger.info(`Curating from ${source.repo}...`);
      const result = await curateFromSource(source);
      results.push(result);
      logger.info(`  → ${result.collectionsCreated} created, ${result.collectionsUpdated} updated (${result.reposFound} repos)`);
    } catch (err) {
      logger.warn(`Failed to curate from ${source.repo}:`, err);
    }
  }
  return results;
}
