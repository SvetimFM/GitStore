import type { ProjectType } from '../types/app.js';
import type { DetectionResult } from '../types/detection.js';
import type { ChildProcess } from 'node:child_process';

export interface RuntimeHandler {
  readonly type: ProjectType;

  /** Attempt to detect this runtime from a list of files. Returns null if not detected. */
  detect(
    files: string[],
    getFileContent: (path: string) => Promise<string>
  ): Promise<DetectionResult | null>;

  /** Install dependencies in a cloned app directory. */
  install(appDir: string, detection: DetectionResult): Promise<void>;

  /** Build the app (if applicable). Returns without error if no build needed. */
  build(appDir: string, detection: DetectionResult): Promise<void>;

  /** Return the command and args needed to start the app. */
  getStartCommand(appDir: string, detection: DetectionResult): { command: string; args: string[] };

  /** Check if this runtime is available on the local machine. */
  isAvailable(): Promise<boolean>;

  /** Get human-readable runtime requirements. */
  getRequirements(): string[];
}

export const runtimeRegistry: RuntimeHandler[] = [];

export function registerRuntime(handler: RuntimeHandler): void {
  runtimeRegistry.push(handler);
}
