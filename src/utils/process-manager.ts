import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, readFileSync, existsSync } from 'node:fs';
import { logger } from './logger.js';

export interface ManagedProcess {
  process: ChildProcess;
  pid: number;
}

export function spawnApp(
  command: string,
  args: string[],
  cwd: string,
  logFile: string,
  env?: Record<string, string>
): ManagedProcess {
  const logStream = createWriteStream(logFile, { flags: 'a' });

  const proc = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  proc.stdout?.pipe(logStream);
  proc.stderr?.pipe(logStream);

  proc.unref();

  logger.info(`Spawned process PID=${proc.pid} cmd="${command} ${args.join(' ')}"`);

  return { process: proc, pid: proc.pid! };
}

export function killProcess(pid: number): boolean {
  try {
    process.kill(pid, 'SIGTERM');
    // Give it 5 seconds, then force kill
    setTimeout(() => {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Already dead
      }
    }, 5000);
    return true;
  } catch {
    return false;
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readLogs(logFile: string, lines: number = 50): string {
  if (!existsSync(logFile)) return '';
  const content = readFileSync(logFile, 'utf-8');
  const allLines = content.split('\n');
  return allLines.slice(-lines).join('\n');
}
