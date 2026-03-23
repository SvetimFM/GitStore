import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, rmSync } from 'node:fs';
import { getRepoInfo, parseRepoString } from './github.js';
import { detectRemote, detectLocal, getRuntimeHandler, checkPrerequisites } from './detector.js';
import { createApp, getAppByName, updateAppStatus, deleteApp, findApp, updateAppUpdatedAt, updateAppStartCommand, updateAppInstalledRef } from './registry.js';
import { paths } from '../utils/paths.js';
import { logger } from '../utils/logger.js';
import type { App } from '../types/app.js';
import type { DetectionResult, PrerequisiteCheck, RiskAssessment } from '../types/detection.js';
import type { RepoInfo } from '../types/github.js';
import { assessRisk } from './safety.js';
import { resolveBinaryInstall, downloadAndExtractBinary, makeBinaryDetection, type BinaryResolution } from './binary-resolver.js';

const execFileAsync = promisify(execFile);

export interface InspectResult {
  repo: RepoInfo;
  detection: DetectionResult | null;
  prerequisites: PrerequisiteCheck | null;
  risk: RiskAssessment | null;
}

export interface InstallResult {
  app: App;
  detection: DetectionResult;
  message: string;
  usedDockerFallback: boolean;
}

/** Inspect a repo: fetch metadata, detect type, check prerequisites. */
export async function inspectRepo(repoStr: string): Promise<InspectResult> {
  const { owner, repo, tag } = parseRepoString(repoStr);

  const repoInfo = await getRepoInfo(owner, repo);

  // Check for pre-built binary first
  const binaryResolution = await resolveBinaryInstall(owner, repo, tag);
  if (binaryResolution) {
    const risk = await assessRisk(owner, repo, repoInfo);
    return {
      repo: repoInfo,
      detection: makeBinaryDetection(binaryResolution, `./${repo}`),
      prerequisites: { met: true, missing: [], available: [] },
      risk,
    };
  }

  const detection = await detectRemote(owner, repo);

  let prerequisites: PrerequisiteCheck | null = null;
  if (detection) {
    prerequisites = await checkPrerequisites(detection);
  }

  const risk = await assessRisk(owner, repo, repoInfo);

  return { repo: repoInfo, detection, prerequisites, risk };
}

/** Install a repo as a local application. */
export async function installApp(
  repoStr: string,
  options: { alias?: string; ref?: string } = {}
): Promise<InstallResult> {
  const { owner, repo, tag } = parseRepoString(repoStr);
  const fullName = `${owner}/${repo}`;

  // Check if already installed
  const existing = getAppByName(fullName);
  if (existing) {
    throw new Error(`${fullName} is already installed (id: ${existing.id}). Use update to get the latest version.`);
  }

  // Get repo info
  const repoInfo = await getRepoInfo(owner, repo);

  // --- Try binary install first ---
  const effectiveTag = tag ?? options.ref;
  const binaryResolution = await resolveBinaryInstall(owner, repo, effectiveTag);
  if (binaryResolution) {
    return performBinaryInstall(owner, repo, repoInfo, binaryResolution, options.alias);
  }

  // --- Fall through to source install ---
  let detection = await detectRemote(owner, repo);
  if (!detection) {
    throw new Error(`Could not detect how to build/run ${fullName}. No recognized project manifest found.`);
  }

  // Check prerequisites
  const prereqs = await checkPrerequisites(detection);
  if (!prereqs.met) {
    if (prereqs.fallbackDetection) {
      logger.info(`Primary runtime ${detection.primaryRuntime} not available, falling back to Docker`);
      detection = prereqs.fallbackDetection;
    } else {
      throw new Error(`Missing prerequisites: ${prereqs.missing.join(', ')}. Please install them first.`);
    }
  }

  const usedDockerFallback = !prereqs.met && !!prereqs.fallbackDetection;

  // Get runtime handler
  const handler = getRuntimeHandler(detection);
  if (!handler) {
    throw new Error(`No runtime handler for ${detection.primaryRuntime}`);
  }

  const installPath = paths.appDir(owner, repo);
  const ref = effectiveTag ?? repoInfo.defaultBranch;

  // Register app (status: installing)
  const app = createApp({
    owner,
    repo,
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
    // Clone
    logger.info(`Cloning ${fullName} to ${installPath}...`);
    await execFileAsync('git', [
      'clone', '--depth', '1', '--recursive',
      '--branch', ref,
      `https://github.com/${fullName}.git`,
      installPath,
    ], { timeout: 120_000 });

    // Re-detect locally (may find additional details)
    const localDetection = usedDockerFallback ? null : await detectLocal(installPath);
    const finalDetection = localDetection ?? detection;

    // Install dependencies
    logger.info(`Installing dependencies...`);
    await handler.install(installPath, finalDetection);

    // Build
    if (finalDetection.buildCommand) {
      logger.info(`Building...`);
      await handler.build(installPath, finalDetection);
    }

    // Update status to installed
    updateAppStatus(app.id, 'installed');

    const installedApp = findApp(app.id)!;
    return {
      app: installedApp,
      detection: finalDetection,
      message: `Successfully installed ${fullName}. Use gitstore start to run it.`,
      usedDockerFallback,
    };
  } catch (err) {
    // Cleanup on failure
    updateAppStatus(app.id, 'error');
    if (existsSync(installPath)) {
      rmSync(installPath, { recursive: true, force: true });
    }
    deleteApp(app.id);

    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Installation failed for ${fullName}: ${msg}`);
  }
}

/** Install a pre-built binary from GitHub Releases. */
async function performBinaryInstall(
  owner: string,
  repo: string,
  repoInfo: RepoInfo,
  resolution: BinaryResolution,
  alias?: string,
): Promise<InstallResult> {
  const fullName = `${owner}/${repo}`;
  const installPath = paths.appDir(owner, repo);

  // Download and extract first — we need the binary path for the app record
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
    owner,
    repo,
    alias,
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
  return {
    app: installedApp,
    detection: makeBinaryDetection(resolution, binaryPath),
    message: `Successfully installed ${fullName} (binary ${resolution.tagName}).`,
    usedDockerFallback: false,
  };
}

/** Update an installed app (git pull + reinstall + rebuild, or re-download binary). */
export async function updateApp(idOrAlias: string): Promise<App> {
  const app = findApp(idOrAlias);
  if (!app) throw new Error(`App not found: ${idOrAlias}`);

  updateAppStatus(app.id, 'installed'); // clear any error state

  try {
    if (app.installType === 'binary') {
      // Binary update: check for newer release and re-download
      logger.info(`Checking for updates to ${app.fullName}...`);
      const resolution = await resolveBinaryInstall(app.owner, app.repo);
      if (!resolution) {
        throw new Error(`No binary release found for ${app.fullName}`);
      }
      if (resolution.tagName === app.installedRef) {
        logger.info(`${app.fullName} is already at ${resolution.tagName}`);
        return findApp(app.id)!;
      }

      // Remove old binary and re-download
      if (existsSync(app.installPath)) {
        rmSync(app.installPath, { recursive: true, force: true });
      }
      const binaryPath = await downloadAndExtractBinary(
        resolution.asset.downloadUrl,
        resolution.asset.name,
        app.installPath,
        app.repo,
      );
      // Update stored command and ref
      updateAppStartCommand(app.id, binaryPath);
      updateAppInstalledRef(app.id, resolution.tagName);
      logger.info(`Updated ${app.fullName} to ${resolution.tagName}`);
    } else {
      // Source update: git pull
      logger.info(`Updating ${app.fullName}...`);
      await execFileAsync('git', ['pull', '--ff-only'], {
        cwd: app.installPath,
        timeout: 60_000,
      });

      // Re-detect and reinstall
      const detection = await detectLocal(app.installPath);
      if (detection) {
        const handler = getRuntimeHandler(detection);
        if (handler) {
          await handler.install(app.installPath, detection);
          if (detection.buildCommand) {
            await handler.build(app.installPath, detection);
          }
        }
      }
    }

    updateAppUpdatedAt(app.id);
    return findApp(app.id)!;
  } catch (err) {
    updateAppStatus(app.id, 'error');
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Update failed for ${app.fullName}: ${msg}`);
  }
}

/** Uninstall an app. */
export async function uninstallApp(idOrAlias: string, keepData: boolean = false): Promise<void> {
  const app = findApp(idOrAlias);
  if (!app) throw new Error(`App not found: ${idOrAlias}`);

  // Stop if running
  if (app.pid) {
    try { process.kill(app.pid, 'SIGTERM'); } catch { /* already dead */ }
  }

  // Remove files
  if (!keepData && existsSync(app.installPath)) {
    rmSync(app.installPath, { recursive: true, force: true });
  }

  // Remove from registry
  deleteApp(app.id);
  logger.info(`Uninstalled ${app.fullName}`);
}
