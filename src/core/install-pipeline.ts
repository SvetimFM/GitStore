import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, rmSync } from 'node:fs';
import { getRepoInfo, parseRepoString } from './github.js';
import { detectRemote, detectLocal, getRuntimeHandler, checkPrerequisites } from './detector.js';
import { createApp, getAppByName, updateAppStatus, deleteApp, findApp } from './registry.js';
import { paths } from '../utils/paths.js';
import { logger } from '../utils/logger.js';
import type { App } from '../types/app.js';
import type { DetectionResult } from '../types/detection.js';
import type { RepoInfo } from '../types/github.js';
import { resolveBinaryInstall, downloadAndExtractBinary, makeBinaryDetection, type BinaryResolution } from './binary-resolver.js';

const execFileAsync = promisify(execFile);

export interface PipelineCallbacks {
  onStatus?(step: string, message: string, extra?: Record<string, unknown>): void;
  onOutput?(stream: 'stdout' | 'stderr', text: string): void;
}

export interface PipelineResult {
  app: App;
  detection: DetectionResult;
  message: string;
  usedDockerFallback: boolean;
}

/**
 * Shared install pipeline used by both CLI (installer.ts) and SSE (install-stream.ts).
 * Emits progress via optional callbacks so callers can report status without duplicating logic.
 */
export async function runInstallPipeline(
  repoStr: string,
  options: { alias?: string; ref?: string } = {},
  callbacks: PipelineCallbacks = {},
): Promise<PipelineResult> {
  const { onStatus, onOutput } = callbacks;
  const { owner, repo, tag } = parseRepoString(repoStr);
  const fullName = `${owner}/${repo}`;

  const existing = getAppByName(fullName);
  if (existing) {
    throw new Error(`${fullName} is already installed (id: ${existing.id}). Use update to get the latest version.`);
  }

  onStatus?.('inspecting', 'Fetching repo info...');
  const effectiveTag = tag ?? options.ref;
  const [repoInfo, binaryResolution] = await Promise.all([
    getRepoInfo(owner, repo),
    resolveBinaryInstall(owner, repo, effectiveTag),
  ]);
  if (binaryResolution) {
    return performBinaryInstall(owner, repo, repoInfo, binaryResolution, options.alias, callbacks);
  }

  onStatus?.('detecting', 'Detecting runtime...');
  let detection = await detectRemote(owner, repo);
  if (!detection) {
    throw new Error(`Could not detect how to build/run ${fullName}. No recognized project manifest found.`);
  }

  const prereqs = await checkPrerequisites(detection);
  let usedDockerFallback = false;
  if (!prereqs.met) {
    if (prereqs.fallbackDetection) {
      logger.info(`Primary runtime ${detection.primaryRuntime} not available, falling back to Docker`);
      detection = prereqs.fallbackDetection;
      usedDockerFallback = true;
    } else {
      throw new Error(`Missing prerequisites: ${prereqs.missing.join(', ')}. Please install them first.`);
    }
  }

  onStatus?.('detected', `Detected ${detection.primaryRuntime}`, { detection });

  const handler = getRuntimeHandler(detection);
  if (!handler) {
    throw new Error(`No runtime handler for ${detection.primaryRuntime}`);
  }

  const installPath = paths.appDir(owner, repo);
  const ref = effectiveTag ?? repoInfo.defaultBranch;

  const app = createApp({
    owner, repo,
    alias: options.alias,
    description: repoInfo.description,
    runtime: detection.primaryRuntime,
    runtimeVersion: detection.runtimeVersion,
    startCommand: detection.startCommand,
    buildCommand: detection.buildCommand,
    installCommand: detection.installCommand,
    port: detection.detectedPort,
    stars: repoInfo.stars,
    language: repoInfo.language,
    license: repoInfo.license,
    defaultBranch: repoInfo.defaultBranch,
    installedRef: ref,
    installPath,
    installType: 'source',
    envVarsRequired: detection.envVarsRequired,
  });

  try {
    onStatus?.('cloning', 'Cloning repository...');
    const cloneArgs = [
      'clone', '--depth', '1', '--recursive',
      '--branch', ref,
      `https://github.com/${fullName}.git`,
      installPath,
    ];
    if (onOutput) {
      await spawnWithOutput('git', cloneArgs, { timeout: 120_000 }, onOutput);
    } else {
      await execFileAsync('git', cloneArgs, { timeout: 120_000 });
    }

    const localDetection = usedDockerFallback ? null : await detectLocal(installPath);
    const finalDetection = localDetection ?? detection;

    onStatus?.('installing', 'Installing dependencies...');
    await handler.install(installPath, finalDetection);

    if (finalDetection.buildCommand) {
      onStatus?.('building', 'Building...');
      await handler.build(installPath, finalDetection);
    }

    updateAppStatus(app.id, 'installed');
    const installedApp = findApp(app.id)!;
    onStatus?.('done', 'Installed successfully', { appId: app.id });

    return {
      app: installedApp,
      detection: finalDetection,
      message: `Successfully installed ${fullName}. Use gitstore start to run it.`,
      usedDockerFallback,
    };
  } catch (err) {
    updateAppStatus(app.id, 'error');
    if (existsSync(installPath)) {
      rmSync(installPath, { recursive: true, force: true });
    }
    deleteApp(app.id);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Installation failed for ${fullName}: ${msg}`);
  }
}

async function performBinaryInstall(
  owner: string,
  repo: string,
  repoInfo: RepoInfo,
  resolution: BinaryResolution,
  alias: string | undefined,
  callbacks: PipelineCallbacks,
): Promise<PipelineResult> {
  const { onStatus } = callbacks;
  const fullName = `${owner}/${repo}`;
  const installPath = paths.appDir(owner, repo);

  onStatus?.('downloading-binary', `Downloading ${resolution.asset.name}...`, {
    detection: { primaryRuntime: 'binary', installType: 'binary' },
  });

  let binaryPath: string;
  try {
    binaryPath = await downloadAndExtractBinary(
      resolution.asset.downloadUrl,
      resolution.asset.name,
      installPath,
      repo,
    );
  } catch (err) {
    if (existsSync(installPath)) {
      rmSync(installPath, { recursive: true, force: true });
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Binary download failed for ${fullName}: ${msg}`);
  }

  const app = createApp({
    owner, repo, alias,
    description: repoInfo.description,
    runtime: 'binary',
    runtimeVersion: resolution.tagName,
    startCommand: binaryPath,
    buildCommand: null,
    installCommand: 'download',
    port: null,
    stars: repoInfo.stars,
    language: repoInfo.language,
    license: repoInfo.license,
    defaultBranch: repoInfo.defaultBranch,
    installedRef: resolution.tagName,
    installPath,
    installType: 'binary',
    envVarsRequired: [],
  });

  updateAppStatus(app.id, 'installed');
  const installedApp = findApp(app.id)!;
  logger.info(`Installed ${fullName} via binary (${resolution.tagName})`);
  onStatus?.('done', `Installed binary ${resolution.tagName}`, { appId: app.id });

  return {
    app: installedApp,
    detection: makeBinaryDetection(resolution, binaryPath),
    message: `Successfully installed ${fullName} (binary ${resolution.tagName}).`,
    usedDockerFallback: false,
  };
}

function spawnWithOutput(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number },
  onOutput: (stream: 'stdout' | 'stderr', text: string) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(command, args, { cwd: options.cwd, timeout: options.timeout });
    proc.stdout?.on('data', (chunk: Buffer) => onOutput('stdout', chunk.toString()));
    proc.stderr?.on('data', (chunk: Buffer) => onOutput('stderr', chunk.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}
