import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, rmSync } from 'node:fs';
import { getRepoInfo, parseRepoString } from './github.js';
import { detectRemote, detectLocal, getRuntimeHandler, checkPrerequisites } from './detector.js';
import { createApp, getAppByName, updateAppStatus, deleteApp, findApp, updateAppUpdatedAt } from './registry.js';
import { paths } from '../utils/paths.js';
import { logger } from '../utils/logger.js';
import type { App } from '../types/app.js';
import type { DetectionResult, PrerequisiteCheck, RiskAssessment } from '../types/detection.js';
import type { RepoInfo } from '../types/github.js';
import { assessRisk } from './safety.js';

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
}

/** Inspect a repo: fetch metadata, detect type, check prerequisites. */
export async function inspectRepo(repoStr: string): Promise<InspectResult> {
  const { owner, repo } = parseRepoString(repoStr);

  const repoInfo = await getRepoInfo(owner, repo);
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
  const { owner, repo } = parseRepoString(repoStr);
  const fullName = `${owner}/${repo}`;

  // Check if already installed
  const existing = getAppByName(fullName);
  if (existing) {
    throw new Error(`${fullName} is already installed (id: ${existing.id}). Use update to get the latest version.`);
  }

  // Get repo info
  const repoInfo = await getRepoInfo(owner, repo);

  // Detect project type
  const detection = await detectRemote(owner, repo);
  if (!detection) {
    throw new Error(`Could not detect how to build/run ${fullName}. No recognized project manifest found.`);
  }

  // Check prerequisites
  const prereqs = await checkPrerequisites(detection);
  if (!prereqs.met) {
    throw new Error(`Missing prerequisites: ${prereqs.missing.join(', ')}. Please install them first.`);
  }

  // Get runtime handler
  const handler = getRuntimeHandler(detection);
  if (!handler) {
    throw new Error(`No runtime handler for ${detection.primaryRuntime}`);
  }

  const installPath = paths.appDir(owner, repo);
  const ref = options.ref ?? repoInfo.defaultBranch;

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
  });

  try {
    // Clone
    logger.info(`Cloning ${fullName} to ${installPath}...`);
    await execFileAsync('git', [
      'clone', '--depth', '1',
      '--branch', ref,
      `https://github.com/${fullName}.git`,
      installPath,
    ], { timeout: 120_000 });

    // Re-detect locally (may find additional details)
    const localDetection = await detectLocal(installPath);
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
      message: `Successfully installed ${fullName}. Use gitstore_start to run it.`,
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

/** Update an installed app (git pull + reinstall + rebuild). */
export async function updateApp(idOrAlias: string): Promise<App> {
  const app = findApp(idOrAlias);
  if (!app) throw new Error(`App not found: ${idOrAlias}`);

  updateAppStatus(app.id, 'installed'); // clear any error state

  try {
    // Git pull
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
