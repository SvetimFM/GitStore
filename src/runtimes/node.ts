import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeHandler } from './base.js';
import type { DetectionResult } from '../types/detection.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

function detectPackageManager(files: string[]): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  if (files.includes('bun.lockb') || files.includes('bun.lock')) return 'bun';
  if (files.includes('pnpm-lock.yaml')) return 'pnpm';
  if (files.includes('yarn.lock')) return 'yarn';
  return 'npm';
}

export const nodeRuntime: RuntimeHandler = {
  type: 'node',

  async detect(files, getFileContent): Promise<DetectionResult | null> {
    if (!files.includes('package.json')) return null;

    let pkg: Record<string, unknown> = {};
    try {
      const content = await getFileContent('package.json');
      pkg = JSON.parse(content) as Record<string, unknown>;
    } catch {
      logger.warn('Failed to parse package.json');
    }

    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    const engines = (pkg.engines ?? {}) as Record<string, string>;
    const pm = detectPackageManager(files);

    // Determine start command
    let startCommand = `${pm} start`;
    if (scripts.start) {
      startCommand = `${pm} run start`;
    } else if (scripts.dev) {
      startCommand = `${pm} run dev`;
    } else if (pkg.main) {
      startCommand = `node ${pkg.main as string}`;
    }

    // Detect port from scripts
    let detectedPort: number | null = null;
    const startScript = scripts.start ?? scripts.dev ?? '';
    const portMatch = startScript.match(/(?:PORT|port)[=:]\s*(\d+)/);
    if (portMatch) {
      detectedPort = parseInt(portMatch[1], 10);
    }
    // Common default ports
    if (!detectedPort) {
      const deps = { ...(pkg.dependencies ?? {}) as Record<string, string>, ...(pkg.devDependencies ?? {}) as Record<string, string> };
      if (deps['next']) detectedPort = 3000;
      else if (deps['vite']) detectedPort = 5173;
      else if (deps['express'] || deps['fastify'] || deps['koa']) detectedPort = 3000;
    }

    // Check for env vars
    const envVarsRequired: string[] = [];
    if (files.includes('.env.example')) {
      try {
        const envContent = await getFileContent('.env.example');
        const vars = envContent.split('\n')
          .filter(l => l.includes('=') && !l.startsWith('#'))
          .map(l => l.split('=')[0].trim())
          .filter(Boolean);
        envVarsRequired.push(...vars);
      } catch { /* ignore */ }
    }

    const hasPostinstall = !!(scripts.postinstall || scripts.preinstall);
    const installCmd = pm === 'npm' ? 'npm install' : pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm install' : 'bun install';

    return {
      primaryRuntime: 'node',
      alternativeRuntimes: files.includes('Dockerfile') ? ['docker'] : [],
      confidence: 'high',
      manifest: 'package.json',
      installCommand: installCmd,
      buildCommand: scripts.build ? `${pm} run build` : null,
      startCommand,
      detectedPort,
      runtimeVersion: engines.node ?? null,
      envVarsRequired,
    };
  },

  async install(appDir: string, detection: DetectionResult): Promise<void> {
    const parts = detection.installCommand.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    logger.info(`Installing: ${detection.installCommand} in ${appDir}`);
    await execFileAsync(cmd, args, { cwd: appDir, timeout: 300_000, maxBuffer: 50 * 1024 * 1024 });
  },

  async build(appDir: string, detection: DetectionResult): Promise<void> {
    if (!detection.buildCommand) return;
    const parts = detection.buildCommand.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    logger.info(`Building: ${detection.buildCommand} in ${appDir}`);
    await execFileAsync(cmd, args, { cwd: appDir, timeout: 300_000, maxBuffer: 50 * 1024 * 1024 });
  },

  getStartCommand(appDir: string, detection: DetectionResult) {
    const parts = detection.startCommand.split(' ');
    return { command: parts[0], args: parts.slice(1) };
  },

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('node', ['--version']);
      return true;
    } catch {
      return false;
    }
  },

  getRequirements(): string[] {
    return ['Node.js (node)', 'npm/yarn/pnpm/bun'];
  },
};
