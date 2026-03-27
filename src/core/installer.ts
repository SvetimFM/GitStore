import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, rmSync } from 'node:fs';
import { getRepoInfo, parseRepoString } from './github.js';
import { detectRemote, detectLocal, getRuntimeHandler, checkPrerequisites } from './detector.js';
import { findApp, updateAppStatus, updateAppUpdatedAt, updateAppStartCommand, updateAppInstalledRef, deleteApp } from './registry.js';
import { logger } from '../utils/logger.js';
import type { App } from '../types/app.js';
import type { DetectionResult, PrerequisiteCheck, RiskAssessment } from '../types/detection.js';
import type { RepoInfo } from '../types/github.js';
import { assessRisk } from './safety.js';
import { resolveBinaryInstall, downloadAndExtractBinary, makeBinaryDetection } from './binary-resolver.js';
import { runInstallPipeline, type PipelineResult } from './install-pipeline.js';

const execFileAsync = promisify(execFile);

export interface InspectResult {
  repo: RepoInfo;
  detection: DetectionResult | null;
  prerequisites: PrerequisiteCheck | null;
  risk: RiskAssessment | null;
}

export type InstallResult = PipelineResult;

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
  return runInstallPipeline(repoStr, options);
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
