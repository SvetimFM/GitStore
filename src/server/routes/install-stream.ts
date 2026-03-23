import { Router } from 'express';
import { parseRepoString, getRepoInfo } from '../../core/github.js';
import { detectRemote, detectLocal, checkPrerequisites, getRuntimeHandler } from '../../core/detector.js';
import { createApp, getAppByName, updateAppStatus, deleteApp, findApp } from '../../core/registry.js';
import { resolveBinaryInstall, downloadAndExtractBinary } from '../../core/binary-resolver.js';
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
    const { owner, repo, tag } = parseRepoString(repoStr);
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

    // Step 2.5: Try binary install first
    send(res, 'status', { step: 'checking-binary', message: 'Checking for pre-built binary...' });
    const binaryResolution = await resolveBinaryInstall(owner, repo, tag);
    if (binaryResolution) {
      send(res, 'status', { step: 'downloading-binary', message: `Downloading ${binaryResolution.asset.name}...`, detection: { primaryRuntime: 'binary', installType: 'binary' } });

      installPath = paths.appDir(owner, repo);
      const binaryPath = await downloadAndExtractBinary(
        binaryResolution.asset.downloadUrl,
        binaryResolution.asset.name,
        installPath,
        repo,
      );

      const app = createApp({
        owner,
        repo,
        description: repoInfo.description,
        runtime: 'binary',
        runtimeVersion: binaryResolution.tagName,
        startCommand: binaryPath,
        buildCommand: null,
        installCommand: 'download',
        port: null,
        stars: repoInfo.stars,
        language: repoInfo.language,
        license: repoInfo.license,
        defaultBranch: repoInfo.defaultBranch,
        installedRef: binaryResolution.tagName,
        installPath,
        installType: 'binary',
        envVarsRequired: [],
      });
      appId = app.id;

      updateAppStatus(app.id, 'installed');
      const installedApp = findApp(app.id)!;
      send(res, 'status', { step: 'done', message: `Installed binary ${binaryResolution.tagName}`, appId: app.id });
      send(res, 'complete', { app: installedApp });
      res.end();
      return;
    }

    // Step 3: Detect runtime (source install)
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
    const ref = tag ?? repoInfo.defaultBranch;

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
      installType: 'source',
      envVarsRequired: detection.envVarsRequired,
    });
    appId = app.id;

    // Step 7: Clone (streamed)
    send(res, 'status', { step: 'cloning', message: 'Cloning repository...' });
    await spawnStreamed(res, 'git', [
      'clone', '--depth', '1', '--recursive',
      '--branch', ref,
      `https://github.com/${fullName}.git`,
      installPath,
    ], { timeout: 120_000 });

    // Step 8: Re-detect locally (may find additional details)
    const localDetection = usedDockerFallback ? null : await detectLocal(installPath);
    const finalDetection = localDetection ?? detection;

    // Step 9: Install dependencies via runtime handler
    send(res, 'status', { step: 'installing', message: 'Installing dependencies...' });
    await handler.install(installPath, finalDetection);

    // Step 10: Build via runtime handler (if needed)
    if (finalDetection.buildCommand) {
      send(res, 'status', { step: 'building', message: 'Building...' });
      await handler.build(installPath, finalDetection);
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
      deleteApp(appId);
    }
    // Clean up install directory even if app record wasn't created yet
    // (e.g., binary download failed before createApp)
    if (installPath && existsSync(installPath)) {
      rmSync(installPath, { recursive: true, force: true });
    }

    send(res, 'error', { message });
  }

  res.end();
});
