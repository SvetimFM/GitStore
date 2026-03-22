import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RuntimeHandler } from './base.js';
import type { DetectionResult } from '../types/detection.js';
import type { ProjectType } from '../types/app.js';

const execFileAsync = promisify(execFile);

export const staticRuntime: RuntimeHandler = {
  type: 'static' as ProjectType,

  async detect(files, _getFileContent): Promise<DetectionResult | null> {
    // Detect if index.html exists in root
    if (!files.includes('index.html')) return null;

    return {
      primaryRuntime: 'static' as ProjectType,
      alternativeRuntimes: [],
      confidence: 'medium', // lower than other runtimes since index.html is common
      manifest: 'index.html',
      installCommand: 'echo "No dependencies"',
      buildCommand: null,
      startCommand: 'npx serve -s . -l PORT',
      detectedPort: 3000,
      runtimeVersion: null,
      envVarsRequired: [],
    };
  },

  async install(_appDir: string, _detection: DetectionResult): Promise<void> {
    // No install step needed for static sites
  },

  async build(_appDir: string, _detection: DetectionResult): Promise<void> {
    // No build step
  },

  getStartCommand(appDir: string, detection: DetectionResult) {
    // Use npx serve (comes with Node.js) to serve static files
    const port = detection.detectedPort ?? 3000;
    return {
      command: 'npx',
      args: ['serve', '-s', appDir, '-l', String(port)],
    };
  },

  async isAvailable(): Promise<boolean> {
    // Just needs Node.js (for npx serve)
    try {
      await execFileAsync('node', ['--version']);
      return true;
    } catch {
      return false;
    }
  },

  getRequirements(): string[] {
    return ['Node.js (for npx serve)'];
  },
};
