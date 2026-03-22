import type { DetectionResult } from '../types/detection.js';
import type { RuntimeHandler } from '../runtimes/base.js';
import { nodeRuntime } from '../runtimes/node.js';
import { pythonRuntime } from '../runtimes/python.js';
import { dockerRuntime } from '../runtimes/docker.js';
import { rustRuntime } from '../runtimes/rust.js';
import { goRuntime } from '../runtimes/go.js';
import { getRepoFiles, getFileContent } from './github.js';
import { logger } from '../utils/logger.js';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Ordered by detection priority — native runtimes first, Docker last as fallback.
// Each native runtime already advertises 'docker' in alternativeRuntimes when a
// Dockerfile is present, and checkPrerequisites handles the Docker fallback case.
const runtimes: RuntimeHandler[] = [
  nodeRuntime,
  pythonRuntime,
  rustRuntime,
  goRuntime,
  dockerRuntime,
];

/** Detect project type from a remote GitHub repo (no clone needed). */
export async function detectRemote(owner: string, repo: string): Promise<DetectionResult | null> {
  const files = await getRepoFiles(owner, repo);
  const fileNames = files.map(f => f.name);

  const getContent = async (path: string): Promise<string> => {
    return getFileContent(owner, repo, path);
  };

  for (const runtime of runtimes) {
    const result = await runtime.detect(fileNames, getContent);
    if (result) {
      logger.info(`Detected ${result.primaryRuntime} for ${owner}/${repo} (confidence: ${result.confidence})`);
      return result;
    }
  }

  logger.warn(`Could not detect runtime for ${owner}/${repo}`);
  return null;
}

/** Detect project type from a local directory (after clone). */
export async function detectLocal(appDir: string): Promise<DetectionResult | null> {
  const entries = readdirSync(appDir);

  const getContent = async (path: string): Promise<string> => {
    return readFileSync(join(appDir, path), 'utf-8');
  };

  for (const runtime of runtimes) {
    const result = await runtime.detect(entries, getContent);
    if (result) {
      return result;
    }
  }

  return null;
}

/** Get the appropriate runtime handler for a detection result. */
export function getRuntimeHandler(detection: DetectionResult): RuntimeHandler | null {
  return runtimes.find(r => r.type === detection.primaryRuntime) ?? null;
}

/** Check if required runtime is available on the machine. */
export async function checkPrerequisites(detection: DetectionResult): Promise<{
  met: boolean;
  missing: string[];
  available: string[];
  fallbackDetection?: DetectionResult;
}> {
  const handler = getRuntimeHandler(detection);
  if (!handler) {
    return { met: false, missing: [`Runtime handler for ${detection.primaryRuntime}`], available: [] };
  }

  const isAvailable = await handler.isAvailable();
  if (isAvailable) {
    return { met: true, missing: [], available: handler.getRequirements() };
  }

  // Primary runtime not available — check for Docker fallback
  if (detection.alternativeRuntimes.includes('docker')) {
    const dockerAvailable = await dockerRuntime.isAvailable();
    if (dockerAvailable) {
      const fallbackDetection: DetectionResult = {
        primaryRuntime: 'docker',
        alternativeRuntimes: [],
        confidence: detection.confidence,
        manifest: 'Dockerfile',
        installCommand: 'docker build -t gitstore-app .',
        buildCommand: null,
        startCommand: detection.detectedPort
          ? `docker run -d -p ${detection.detectedPort}:${detection.detectedPort} --name gitstore-app`
          : 'docker run -d --name gitstore-app',
        detectedPort: detection.detectedPort,
        runtimeVersion: null,
        envVarsRequired: detection.envVarsRequired,
      };
      return { met: false, missing: handler.getRequirements(), available: [], fallbackDetection };
    }
  }

  return { met: false, missing: handler.getRequirements(), available: [] };
}
