import { Router } from 'express';
import { parseRepoString, getRepoInfo } from '../../core/github.js';
import { detectRemote, detectLocal, checkPrerequisites, getRuntimeHandler } from '../../core/detector.js';
import { createApp, getAppByName, updateAppStatus, deleteApp, findApp } from '../../core/registry.js';
import { paths } from '../../utils/paths.js';
import { logger } from '../../utils/logger.js';
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import type { Response } from 'express';

export const installStreamRouter = Router();

function send(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function spawnStreamed(
  res: Response,
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number },
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      timeout: options.timeout,
    });

    proc.stdout?.on('data', (chunk: Buffer) => {
      send(res, 'output', { stream: 'stdout', text: chunk.toString() });
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      send(res, 'output', { stream: 'stderr', text: chunk.toString() });
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });

    proc.on('error', reject);
  });
}

installStreamRouter.get('/install-stream', async (req, res) => {
  const repoStr = req.query.repo as string;
  if (!repoStr) {
    res.status(400).json({ error: 'repo query param required' });
    return;
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let appId: string | null = null;
  let installPath: string | null = null;

  try {
    // Step 1: Parse repo string
    const { owner, repo } = parseRepoString(repoStr);
    const fullName = `${owner}/${repo}`;

    // Check if already installed
    const existing = getAppByName(fullName);
    if (existing) {
      send(res, 'error', { message: `${fullName} is already installed (id: ${existing.id}). Use update to get the latest version.` });
      res.end();
      return;
    }

    // Step 2: Fetch repo info
    send(res, 'status', { step: 'inspecting', message: 'Fetching repo info...' });
    const repoInfo = await getRepoInfo(owner, repo);

    // Step 3: Detect runtime
    send(res, 'status', { step: 'detecting', message: 'Detecting runtime...' });
    let detection = await detectRemote(owner, repo);
    if (!detection) {
      send(res, 'error', { message: `Could not detect how to build/run ${fullName}. No recognized project manifest found.` });
      res.end();
      return;
    }

    // Step 4: Check prerequisites
    const prereqs = await checkPrerequisites(detection);
    let usedDockerFallback = false;
    if (!prereqs.met) {
      if (prereqs.fallbackDetection) {
        logger.info(`Primary runtime ${detection.primaryRuntime} not available, falling back to Docker`);
        detection = prereqs.fallbackDetection;
        usedDockerFallback = true;
      } else {
        send(res, 'error', { message: `Missing prerequisites: ${prereqs.missing.join(', ')}. Please install them first.` });
        res.end();
        return;
      }
    }

    send(res, 'status', { step: 'detected', message: `Detected ${detection.primaryRuntime}`, detection });

    // Step 5: Get runtime handler
    const handler = getRuntimeHandler(detection);
    if (!handler) {
      send(res, 'error', { message: `No runtime handler for ${detection.primaryRuntime}` });
      res.end();
      return;
    }

    // Step 6: Create app record
    installPath = paths.appDir(owner, repo);
    const ref = repoInfo.defaultBranch;

    const app = createApp({
      owner,
      repo,
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
      envVarsRequired: detection.envVarsRequired,
    });
    appId = app.id;

    // Step 7: Clone (streamed)
    send(res, 'status', { step: 'cloning', message: 'Cloning repository...' });
    await spawnStreamed(res, 'git', [
      'clone', '--depth', '1',
      '--branch', ref,
      `https://github.com/${fullName}.git`,
      installPath,
    ], { timeout: 120_000 });

    // Step 8: Re-detect locally (may find additional details)
    const localDetection = usedDockerFallback ? null : await detectLocal(installPath);
    const finalDetection = localDetection ?? detection;

    // Step 9: Install dependencies (streamed)
    send(res, 'status', { step: 'installing', message: 'Installing dependencies...' });
    const installParts = finalDetection.installCommand.split(' ');
    await spawnStreamed(res, installParts[0], installParts.slice(1), {
      cwd: installPath,
      timeout: 600_000,
    });

    // Step 10: Build (streamed, if needed)
    if (finalDetection.buildCommand) {
      send(res, 'status', { step: 'building', message: 'Building...' });
      const buildParts = finalDetection.buildCommand.split(' ');
      await spawnStreamed(res, buildParts[0], buildParts.slice(1), {
        cwd: installPath,
        timeout: 600_000,
      });
    }

    // Step 11: Done
    updateAppStatus(app.id, 'installed');
    const installedApp = findApp(app.id)!;
    send(res, 'status', { step: 'done', message: 'Installed successfully', appId: app.id });
    send(res, 'complete', { app: installedApp });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Install stream error: ${message}`);

    // Cleanup on failure
    if (appId) {
      updateAppStatus(appId, 'error');
      if (installPath && existsSync(installPath)) {
        rmSync(installPath, { recursive: true, force: true });
      }
      deleteApp(appId);
    }

    send(res, 'error', { message });
  }

  res.end();
});
