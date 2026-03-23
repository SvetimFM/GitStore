import { join } from 'node:path';

export const isWindows = process.platform === 'win32';

export function venvBin(appDir: string, bin: string): string {
  return isWindows
    ? join(appDir, '.venv', 'Scripts', `${bin}.exe`)
    : join(appDir, '.venv', 'bin', bin);
}

export function pythonCmd(): string {
  return isWindows ? 'python' : 'python3';
}

/**
 * Parse environment variable names from .env.example or .env.sample files.
 * Shared across all runtime handlers.
 */
export async function parseEnvVars(
  files: string[],
  getFileContent: (path: string) => Promise<string>,
  candidates = ['.env.example', '.env.sample'],
): Promise<string[]> {
  for (const candidate of candidates) {
    if (!files.includes(candidate)) continue;
    try {
      const content = await getFileContent(candidate);
      return content.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => l.split('=')[0].trim())
        .filter(Boolean);
    } catch { /* ignore */ }
  }
  return [];
}
