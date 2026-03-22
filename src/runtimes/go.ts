import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import type { RuntimeHandler } from './base.js';
import type { DetectionResult } from '../types/detection.js';
import { parseEnvVars } from './utils.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

function parseModuleName(goModContent: string): string {
  const match = goModContent.match(/^module\s+(.+)$/m);
  if (!match) return 'app';
  const modulePath = match[1].trim();
  // Use the last segment of the module path as the binary name
  const parts = modulePath.split('/');
  return parts[parts.length - 1];
}

export const goRuntime: RuntimeHandler = {
  type: 'go',

  async detect(files, getFileContent): Promise<DetectionResult | null> {
    if (!files.includes('go.mod')) return null;

    let goModContent = '';
    let binaryName = 'app';
    let goVersion: string | null = null;
    try {
      goModContent = await getFileContent('go.mod');
      binaryName = parseModuleName(goModContent);
      const versionMatch = goModContent.match(/^go\s+(\d+\.\d+(?:\.\d+)?)$/m);
      if (versionMatch) goVersion = versionMatch[1];
    } catch {
      logger.warn('Failed to parse go.mod');
    }

    const envVarsRequired = await parseEnvVars(files, getFileContent);

    // Detect ports from go.mod dependencies (no need to fetch go.sum)
    let detectedPort: number | null = null;
    if (goModContent.includes('gin-gonic/gin')) detectedPort = 8080;
    else if (goModContent.includes('gofiber/fiber')) detectedPort = 3000;
    else if (goModContent.includes('labstack/echo')) detectedPort = 1323;

    return {
      primaryRuntime: 'go',
      alternativeRuntimes: files.includes('Dockerfile') ? ['docker'] : [],
      confidence: 'high',
      manifest: 'go.mod',
      installCommand: `go build -o ./${binaryName} .`,
      buildCommand: null,
      startCommand: `./${binaryName}`,
      detectedPort,
      runtimeVersion: goVersion,
      envVarsRequired,
    };
  },

  async install(appDir: string, detection: DetectionResult): Promise<void> {
    const binaryName = detection.startCommand.replace('./', '');
    logger.info(`Building Go project in ${appDir}`);
    await execFileAsync('go', ['build', '-o', `./${binaryName}`, '.'], {
      cwd: appDir,
      timeout: 600_000,
      maxBuffer: 50 * 1024 * 1024,
    });
  },

  async build(_appDir: string, _detection: DetectionResult): Promise<void> {
    // Build happens during install for Go
  },

  getStartCommand(appDir: string, detection: DetectionResult) {
    const binaryName = detection.startCommand.replace('./', '');
    return {
      command: join(appDir, binaryName),
      args: [],
    };
  },

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('go', ['version']);
      return true;
    } catch {
      return false;
    }
  },

  getRequirements(): string[] {
    return ['Go toolchain (go)'];
  },
};
