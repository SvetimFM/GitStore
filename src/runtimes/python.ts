import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeHandler } from './base.js';
import type { DetectionResult } from '../types/detection.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

function detectPythonEntrypoint(files: string[]): string | null {
  const candidates = ['app.py', 'main.py', 'run.py', 'server.py', 'manage.py', 'wsgi.py'];
  for (const c of candidates) {
    if (files.includes(c)) return c;
  }
  return null;
}

export const pythonRuntime: RuntimeHandler = {
  type: 'python',

  async detect(files, getFileContent): Promise<DetectionResult | null> {
    const hasRequirements = files.includes('requirements.txt');
    const hasPyproject = files.includes('pyproject.toml');
    const hasSetupPy = files.includes('setup.py');

    if (!hasRequirements && !hasPyproject && !hasSetupPy) return null;

    let manifest = 'requirements.txt';
    let installCommand = 'pip install -r requirements.txt';

    if (hasPyproject) {
      manifest = 'pyproject.toml';
      installCommand = 'pip install .';
      try {
        const content = await getFileContent('pyproject.toml');
        // Check for poetry
        if (content.includes('[tool.poetry]')) {
          installCommand = 'poetry install';
        }
        // Check for uv
        if (files.includes('uv.lock')) {
          installCommand = 'uv sync';
        }
      } catch { /* use default */ }
    } else if (hasSetupPy && !hasRequirements) {
      manifest = 'setup.py';
      installCommand = 'pip install .';
    }

    // Detect entrypoint
    const entrypoint = detectPythonEntrypoint(files);
    let startCommand = entrypoint ? `python ${entrypoint}` : 'python -m app';

    // Check for common frameworks
    let detectedPort: number | null = null;
    if (hasRequirements) {
      try {
        const content = await getFileContent('requirements.txt');
        if (/flask/i.test(content)) {
          startCommand = entrypoint ? `python ${entrypoint}` : 'flask run';
          detectedPort = 5000;
        } else if (/django/i.test(content)) {
          startCommand = 'python manage.py runserver';
          detectedPort = 8000;
        } else if (/fastapi|uvicorn/i.test(content)) {
          startCommand = entrypoint
            ? `uvicorn ${entrypoint.replace('.py', '')}:app --host 0.0.0.0`
            : 'uvicorn main:app --host 0.0.0.0';
          detectedPort = 8000;
        } else if (/streamlit/i.test(content)) {
          startCommand = entrypoint ? `streamlit run ${entrypoint}` : 'streamlit run app.py';
          detectedPort = 8501;
        }
      } catch { /* use default */ }
    }

    // Check for env vars
    const envVarsRequired: string[] = [];
    if (files.includes('.env.example') || files.includes('.env.sample')) {
      try {
        const envFile = files.includes('.env.example') ? '.env.example' : '.env.sample';
        const content = await getFileContent(envFile);
        const vars = content.split('\n')
          .filter(l => l.includes('=') && !l.startsWith('#'))
          .map(l => l.split('=')[0].trim())
          .filter(Boolean);
        envVarsRequired.push(...vars);
      } catch { /* ignore */ }
    }

    // Detect python version
    let runtimeVersion: string | null = null;
    if (files.includes('.python-version')) {
      try {
        runtimeVersion = (await getFileContent('.python-version')).trim();
      } catch { /* ignore */ }
    }

    return {
      primaryRuntime: 'python',
      alternativeRuntimes: files.includes('Dockerfile') ? ['docker'] : [],
      confidence: hasRequirements || hasPyproject ? 'high' : 'medium',
      manifest,
      installCommand,
      buildCommand: null,
      startCommand,
      detectedPort,
      runtimeVersion,
      envVarsRequired,
    };
  },

  async install(appDir: string, detection: DetectionResult): Promise<void> {
    // Create venv
    const venvPath = join(appDir, '.venv');
    if (!existsSync(venvPath)) {
      logger.info(`Creating Python venv in ${appDir}...`);
      await execFileAsync('python3', ['-m', 'venv', '.venv'], { cwd: appDir, timeout: 60_000 });
    }

    const pip = join(venvPath, 'bin', 'pip');

    // Install deps
    const cmd = detection.installCommand;
    logger.info(`Installing: ${cmd} in ${appDir}`);

    if (cmd.startsWith('pip install')) {
      const args = cmd.replace('pip', '').trim().split(' ');
      await execFileAsync(pip, args, { cwd: appDir, timeout: 300_000, maxBuffer: 50 * 1024 * 1024 });
    } else if (cmd.startsWith('poetry')) {
      await execFileAsync('poetry', ['install'], { cwd: appDir, timeout: 300_000 });
    } else if (cmd.startsWith('uv')) {
      await execFileAsync('uv', ['sync'], { cwd: appDir, timeout: 300_000 });
    }
  },

  async build(_appDir: string, _detection: DetectionResult): Promise<void> {
    // Python typically doesn't need a build step
  },

  getStartCommand(appDir: string, detection: DetectionResult) {
    const venvPython = join(appDir, '.venv', 'bin', 'python');
    const parts = detection.startCommand.split(' ');

    // Replace 'python' with venv python
    if (parts[0] === 'python' || parts[0] === 'python3') {
      return { command: venvPython, args: parts.slice(1) };
    }

    // For tools like uvicorn, flask, streamlit — use venv bin
    const venvBin = join(appDir, '.venv', 'bin', parts[0]);
    if (existsSync(venvBin)) {
      return { command: venvBin, args: parts.slice(1) };
    }

    return { command: parts[0], args: parts.slice(1) };
  },

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('python3', ['--version']);
      return true;
    } catch {
      return false;
    }
  },

  getRequirements(): string[] {
    return ['Python 3 (python3)', 'pip'];
  },
};
