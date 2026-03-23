import { join } from 'node:path';
import type { RuntimeHandler } from './base.js';
import type { DetectionResult } from '../types/detection.js';
import type { ProjectType } from '../types/app.js';

export const binaryRuntime: RuntimeHandler = {
  type: 'binary' as ProjectType,

  async detect(_files, _getFileContent): Promise<DetectionResult | null> {
    // Binary installs are resolved via GitHub Releases, not file detection
    return null;
  },

  async install(_appDir: string, _detection: DetectionResult): Promise<void> {
    // No-op: binary is already downloaded and extracted
  },

  async build(_appDir: string, _detection: DetectionResult): Promise<void> {
    // No-op: pre-built binary
  },

  getStartCommand(appDir: string, detection: DetectionResult) {
    const parts = detection.startCommand.split(' ');
    return { command: parts[0], args: parts.slice(1) };
  },

  async isAvailable(): Promise<boolean> {
    return true; // Always available — it's just a downloaded binary
  },

  getRequirements(): string[] {
    return [];
  },
};
