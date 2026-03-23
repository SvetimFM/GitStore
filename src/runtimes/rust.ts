import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeHandler } from './base.js';
import type { DetectionResult } from '../types/detection.js';
import { parseEnvVars } from './utils.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

function parseBinaryName(cargoContent: string, files: string[]): string {
  // Try to extract package name from Cargo.toml
  const nameMatch = cargoContent.match(/^\[package\]\s*\n(?:.*\n)*?name\s*=\s*"([^"]+)"/m)
    ?? cargoContent.match(/name\s*=\s*"([^"]+)"/);
  if (nameMatch) return nameMatch[1];

  // Fallback: look for src/main.rs — means the package name is the directory name
  if (files.includes('src/main.rs') || files.includes('src')) return 'app';

  return 'app';
}

export const rustRuntime: RuntimeHandler = {
  type: 'rust',

  async detect(files, getFileContent): Promise<DetectionResult | null> {
    if (!files.includes('Cargo.toml')) return null;

    let cargoContent = '';
    let binaryName = 'app';
    try {
      cargoContent = await getFileContent('Cargo.toml');
      binaryName = parseBinaryName(cargoContent, files);
    } catch {
      logger.warn('Failed to parse Cargo.toml');
    }

    const envVarsRequired = await parseEnvVars(files, getFileContent);

    // Detect edition/version from Cargo.toml
    const editionMatch = cargoContent.match(/edition\s*=\s*"(\d+)"/);
    const runtimeVersion = editionMatch ? `edition ${editionMatch[1]}` : null;

    // Check for web frameworks to detect ports
    let detectedPort: number | null = null;
    if (cargoContent.includes('actix-web')) detectedPort = 8080;
    else if (cargoContent.includes('axum') || cargoContent.includes('warp')) detectedPort = 3000;
    else if (cargoContent.includes('rocket')) detectedPort = 8000;

    return {
      primaryRuntime: 'rust',
      alternativeRuntimes: files.includes('Dockerfile') ? ['docker'] : [],
      confidence: 'high',
      manifest: 'Cargo.toml',
      installCommand: 'cargo build --release',
      buildCommand: null,
      startCommand: `./target/release/${binaryName}`,
      detectedPort,
      runtimeVersion,
      envVarsRequired,
    };
  },

  async install(appDir: string, _detection: DetectionResult): Promise<void> {
    logger.info(`Building Rust project in ${appDir}`);
    await execFileAsync('cargo', ['build', '--release'], {
      cwd: appDir,
      timeout: 2_700_000,
      maxBuffer: 50 * 1024 * 1024,
    });
  },

  async build(_appDir: string, _detection: DetectionResult): Promise<void> {
    // Build happens during install for Rust
  },

  getStartCommand(appDir: string, detection: DetectionResult) {
    // Try to find the actual binary in target/release
    const releasePath = join(appDir, 'target', 'release');
    let binaryName = detection.startCommand.replace('./target/release/', '');

    if (existsSync(releasePath)) {
      try {
        const entries = readdirSync(releasePath, { withFileTypes: true });
        const executables = entries
          .filter(e => e.isFile() && !e.name.includes('.') && !e.name.startsWith('.'))
          .map(e => e.name);
        if (executables.length === 1) {
          binaryName = executables[0];
        } else if (executables.length > 1) {
          if (!executables.includes(binaryName)) {
            logger.warn(`Multiple executables found in target/release: ${executables.join(', ')}. Using default: ${binaryName}`);
          }
        }
      } catch { /* use default */ }
    }

    return {
      command: join(appDir, 'target', 'release', binaryName),
      args: [],
    };
  },

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('cargo', ['--version']);
      return true;
    } catch {
      return false;
    }
  },

  getRequirements(): string[] {
    return ['Rust toolchain (cargo, rustc)'];
  },
};
