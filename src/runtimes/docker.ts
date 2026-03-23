import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import type { RuntimeHandler } from './base.js';
import type { DetectionResult } from '../types/detection.js';
import { parseEnvVars } from './utils.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

function dockerImageName(appDir: string): string {
  const raw = `gitstore-${basename(dirname(appDir))}-${basename(appDir)}`;
  return raw.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}

export const dockerRuntime: RuntimeHandler = {
  type: 'docker',

  async detect(files, getFileContent): Promise<DetectionResult | null> {
    const hasDockerfile = files.includes('Dockerfile');
    const hasCompose = files.includes('docker-compose.yml') || files.includes('docker-compose.yaml') || files.includes('compose.yml') || files.includes('compose.yaml');

    if (!hasDockerfile && !hasCompose) return null;

    let detectedPort: number | null = null;
    let startCommand: string;
    let manifest: string;

    if (hasCompose) {
      manifest = files.includes('docker-compose.yml') ? 'docker-compose.yml'
        : files.includes('docker-compose.yaml') ? 'docker-compose.yaml'
        : files.includes('compose.yml') ? 'compose.yml' : 'compose.yaml';
      startCommand = 'docker compose up';

      // Try to parse port from compose file
      try {
        const content = await getFileContent(manifest);
        const portMatch = content.match(/ports:\s*\n\s*-\s*"?(\d+):(\d+)/);
        if (portMatch) {
          detectedPort = parseInt(portMatch[1], 10);
        }
      } catch { /* ignore */ }
    } else {
      manifest = 'Dockerfile';
      startCommand = 'docker run -d --name gitstore-app';

      // Parse EXPOSE from Dockerfile
      try {
        const content = await getFileContent('Dockerfile');
        const exposeMatch = content.match(/^EXPOSE\s+(\d+)/m);
        if (exposeMatch) {
          detectedPort = parseInt(exposeMatch[1], 10);
          startCommand = `docker run -d -p ${detectedPort}:${detectedPort} --name gitstore-app`;
        }
      } catch { /* ignore */ }
    }

    const envVarsRequired = await parseEnvVars(files, getFileContent);

    return {
      primaryRuntime: 'docker',
      alternativeRuntimes: [],
      confidence: 'high',
      manifest,
      installCommand: hasCompose ? 'docker compose build' : 'docker build -t gitstore-app .',
      buildCommand: null,  // build is part of install for Docker
      startCommand,
      detectedPort,
      runtimeVersion: null,
      envVarsRequired,
    };
  },

  async install(appDir: string, detection: DetectionResult): Promise<void> {
    const imageName = dockerImageName(appDir);
    const isCompose = detection.manifest.includes('compose');

    if (isCompose) {
      logger.info(`Building with docker compose in ${appDir}...`);
      await execFileAsync('docker', ['compose', 'build'], {
        cwd: appDir,
        timeout: 600_000,
        maxBuffer: 50 * 1024 * 1024,
      });
    } else {
      logger.info(`Building Docker image ${imageName}...`);
      await execFileAsync('docker', ['build', '-t', imageName, '.'], {
        cwd: appDir,
        timeout: 600_000,
        maxBuffer: 50 * 1024 * 1024,
      });
    }
  },

  async build(_appDir: string, _detection: DetectionResult): Promise<void> {
    // Docker build happens during install
  },

  getStartCommand(appDir: string, detection: DetectionResult) {
    const isCompose = detection.manifest.includes('compose');
    if (isCompose) {
      return { command: 'docker', args: ['compose', 'up', '-d'] };
    }

    const imageName = dockerImageName(appDir);
    const containerName = imageName;
    const args = ['run', '-d', '--rm', '--name', containerName];

    if (detection.detectedPort) {
      args.push('-p', `${detection.detectedPort}:${detection.detectedPort}`);
    }

    args.push(imageName);
    return { command: 'docker', args };
  },

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('docker', ['--version']);
      return true;
    } catch {
      return false;
    }
  },

  getRequirements(): string[] {
    return ['Docker'];
  },
};
