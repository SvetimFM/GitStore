import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, readdirSync, chmodSync, renameSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { join, extname, basename } from 'node:path';
import { getLatestRelease, getReleaseByTag, getGithubDownloadHeaders, type GitHubRelease } from './github.js';
import { logger } from '../utils/logger.js';
import type { DetectionResult, BinaryAsset } from '../types/detection.js';

const execFileAsync = promisify(execFile);

// Platform tokens to match in asset filenames (case-insensitive)
const PLATFORM_TOKENS: Record<string, string[]> = {
  darwin: ['darwin', 'macos', 'osx', 'apple'],
  linux: ['linux'],
  win32: ['windows', 'win64', 'win'],
};

const ARCH_TOKENS: Record<string, string[]> = {
  arm64: ['arm64', 'aarch64'],
  x64: ['amd64', 'x86_64', 'x64'],
  ia32: ['i386', 'i686', '386'],
};

const ARCHIVE_EXTENSIONS = ['.tar.gz', '.tgz', '.zip'];

// Extensions to skip — not usable binaries or archives
const SKIP_EXTENSIONS = [
  '.deb', '.rpm', '.msi', '.pkg', '.dmg',
  '.sha256', '.sha512', '.sig', '.asc', '.sbom',
  '.txt', '.md', '.json', '.yaml', '.yml',
];

export interface BinaryResolution {
  asset: { name: string; downloadUrl: string; size: number };
  tagName: string;
  platform: string;
  arch: string;
}

function getAssetExtension(name: string): string {
  if (name.endsWith('.tar.gz')) return '.tar.gz';
  if (name.endsWith('.tar.xz')) return '.tar.xz';
  if (name.endsWith('.tar.bz2')) return '.tar.bz2';
  return extname(name);
}

/**
 * Score a release asset against the current platform and architecture.
 * Returns -1 if the asset is definitely wrong (wrong platform/arch).
 */
function scoreAsset(assetName: string, platform: string, arch: string): number {
  const lower = assetName.toLowerCase();
  const ext = getAssetExtension(lower);

  // Skip non-binary extensions
  if (SKIP_EXTENSIONS.includes(ext)) return -1;

  // Skip unsupported archive formats
  if (ext === '.tar.xz' || ext === '.tar.bz2') return -1;

  let score = 0;

  // Check platform match
  const platformTokens = PLATFORM_TOKENS[platform] ?? [];
  const hasPlatformMatch = platformTokens.some(t => lower.includes(t));
  if (hasPlatformMatch) {
    score += 10;
  } else {
    // Check if it matches a DIFFERENT platform — disqualify
    for (const [p, tokens] of Object.entries(PLATFORM_TOKENS)) {
      if (p !== platform && tokens.some(t => lower.includes(t))) {
        return -1;
      }
    }
  }

  // Check arch match
  const archTokens = ARCH_TOKENS[arch] ?? [];
  const hasArchMatch = archTokens.some(t => lower.includes(t));
  if (hasArchMatch) {
    score += 10;
  } else {
    // Check if it matches a DIFFERENT arch — disqualify
    for (const [a, tokens] of Object.entries(ARCH_TOKENS)) {
      if (a !== arch && tokens.some(t => lower.includes(t))) {
        return -1;
      }
    }
  }

  // Prefer archives (contain the binary + maybe docs)
  if (ARCHIVE_EXTENSIONS.some(e => lower.endsWith(e))) {
    score += 5;
  }

  // Must match at least platform to be considered
  if (!hasPlatformMatch) return -1;

  return score;
}

/**
 * Find the best matching asset for the current platform from a release's assets.
 */
export function findMatchingAsset(
  assets: GitHubRelease['assets'],
  platform = process.platform,
  arch = process.arch,
): GitHubRelease['assets'][0] | null {
  let bestAsset: GitHubRelease['assets'][0] | null = null;
  let bestScore = 0;

  for (const asset of assets) {
    const s = scoreAsset(asset.name, platform, arch);
    if (s > bestScore) {
      bestScore = s;
      bestAsset = asset;
    }
  }

  return bestAsset;
}

/**
 * Build a DetectionResult for a binary install.
 */
export function makeBinaryDetection(resolution: BinaryResolution, startCommand: string): DetectionResult {
  return {
    primaryRuntime: 'binary',
    alternativeRuntimes: [],
    confidence: 'high',
    manifest: `GitHub Release ${resolution.tagName}`,
    installCommand: 'download',
    buildCommand: null,
    startCommand,
    detectedPort: null,
    runtimeVersion: resolution.tagName,
    envVarsRequired: [],
    installType: 'binary',
    binaryAsset: {
      name: resolution.asset.name,
      downloadUrl: resolution.asset.downloadUrl,
      size: resolution.asset.size,
      tagName: resolution.tagName,
    },
  };
}

/**
 * Try to resolve a binary install from GitHub Releases.
 * Returns null if no matching binary found.
 */
export async function resolveBinaryInstall(
  owner: string,
  repo: string,
  tag?: string,
): Promise<BinaryResolution | null> {
  const release = tag
    ? await getReleaseByTag(owner, repo, tag)
    : await getLatestRelease(owner, repo);

  if (!release || release.assets.length === 0) return null;

  const asset = findMatchingAsset(release.assets);
  if (!asset) return null;

  logger.info(`Found binary asset: ${asset.name} (${release.tagName}) for ${process.platform}/${process.arch}`);

  return {
    asset: { name: asset.name, downloadUrl: asset.downloadUrl, size: asset.size },
    tagName: release.tagName,
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * Download a release asset and extract it to the target directory.
 * Returns the path to the executable binary.
 */
export async function downloadAndExtractBinary(
  downloadUrl: string,
  assetName: string,
  targetDir: string,
  repoName: string,
): Promise<string> {
  // Only allow downloads from GitHub (prevents SSRF via crafted release URLs)
  const url = new URL(downloadUrl);
  if (url.hostname !== 'github.com' && !url.hostname.endsWith('.githubusercontent.com')) {
    throw new Error('Binary downloads are only allowed from GitHub');
  }

  mkdirSync(targetDir, { recursive: true });

  const ext = getAssetExtension(assetName.toLowerCase());
  const assetPath = join(targetDir, assetName);

  // Download the asset with auth headers (needed for private repos)
  logger.info(`Downloading ${assetName}...`);
  const headers = getGithubDownloadHeaders();
  const res = await fetch(downloadUrl, { redirect: 'follow', headers });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  // Stream to disk to avoid buffering large binaries in memory
  if (!res.body) throw new Error('Download returned empty body');
  const fileStream = createWriteStream(assetPath);
  await pipeline(Readable.fromWeb(res.body as import('stream/web').ReadableStream), fileStream);

  // Extract or use directly
  if (ext === '.tar.gz' || ext === '.tgz') {
    // --no-absolute-filenames prevents writing to absolute paths (Zip Slip defense)
    await execFileAsync('tar', ['xzf', assetPath, '-C', targetDir, '--no-absolute-filenames']);
  } else if (ext === '.zip') {
    await execFileAsync('unzip', ['-o', assetPath, '-d', targetDir]);
  } else {
    // Bare binary — make it executable directly
    const binaryPath = join(targetDir, repoName);
    renameSync(assetPath, binaryPath);
    chmodSync(binaryPath, 0o700);
    return binaryPath;
  }

  // Find the executable in the extracted files
  return findExecutable(targetDir, repoName);
}

// Directories to skip when scanning for executables
const SKIP_DIRS = new Set(['completions', 'doc', 'man', 'share', 'lib', 'include', '__MACOSX', '.github']);

/**
 * Recursively search for the executable binary in the extracted directory.
 */
function findExecutable(dir: string, preferredName: string): string {
  const isWin = process.platform === 'win32';
  const candidates: string[] = [];

  function scan(d: string, depth: number): void {
    if (depth > 5) return; // Limit recursion depth
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return; // Permission error or broken symlink — skip
    }
    for (const entry of entries) {
      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        scan(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        // Skip archive, docs, checksums
        if (['.md', '.txt', '.sha256', '.sig', '.1', '.tar.gz', '.tgz', '.zip'].includes(ext)) continue;
        // On Unix: files with no extension are likely binaries
        // On Windows: .exe files
        if (isWin ? ext === '.exe' : ext === '') {
          candidates.push(fullPath);
        }
      }
    }
  }

  scan(dir, 0);

  if (candidates.length === 0) {
    throw new Error(`No executable found in extracted archive`);
  }

  // Prefer the one matching the repo name
  const preferred = candidates.find(c => {
    const name = basename(c).replace(/\.exe$/i, '');
    return name === preferredName;
  });

  const chosen = preferred ?? candidates[0];
  chmodSync(chosen, 0o755);
  return chosen;
}
