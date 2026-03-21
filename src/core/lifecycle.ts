import { findApp, updateAppStatus, listApps } from './registry.js';
import { detectLocal, getRuntimeHandler } from './detector.js';
import { spawnApp, killProcess, isProcessRunning, readLogs } from '../utils/process-manager.js';
import { paths } from '../utils/paths.js';
import { logger } from '../utils/logger.js';
import type { App } from '../types/app.js';

/** Start an installed app. */
export async function startApp(
  idOrAlias: string,
  options: { port?: number; env?: Record<string, string> } = {}
): Promise<App> {
  const app = findApp(idOrAlias);
  if (!app) throw new Error(`App not found: ${idOrAlias}`);

  if (app.status === 'running' && app.pid && isProcessRunning(app.pid)) {
    throw new Error(`${app.fullName} is already running (PID: ${app.pid})`);
  }

  // Get runtime handler to determine start command
  const detection = await detectLocal(app.installPath);
  const handler = detection ? getRuntimeHandler(detection) : null;

  let command: string;
  let args: string[];

  if (handler && detection) {
    const startCmd = handler.getStartCommand(app.installPath, detection);
    command = startCmd.command;
    args = startCmd.args;
  } else {
    // Fallback to stored start command
    const parts = app.startCommand.split(' ');
    command = parts[0];
    args = parts.slice(1);
  }

  const logFile = paths.appLog(app.owner, app.repo);

  const env: Record<string, string> = { ...options.env };
  if (options.port) {
    env.PORT = String(options.port);
  } else if (app.port) {
    env.PORT = String(app.port);
  }

  const managed = spawnApp(command, args, app.installPath, logFile, env);
  updateAppStatus(app.id, 'running', managed.pid);

  logger.info(`Started ${app.fullName} (PID: ${managed.pid})`);
  return findApp(app.id)!;
}

/** Stop a running app. */
export async function stopApp(idOrAlias: string): Promise<App> {
  const app = findApp(idOrAlias);
  if (!app) throw new Error(`App not found: ${idOrAlias}`);

  if (!app.pid) {
    updateAppStatus(app.id, 'stopped');
    return findApp(app.id)!;
  }

  if (isProcessRunning(app.pid)) {
    killProcess(app.pid);
    logger.info(`Stopped ${app.fullName} (PID: ${app.pid})`);
  }

  updateAppStatus(app.id, 'stopped');
  return findApp(app.id)!;
}

/** Restart a running app. */
export async function restartApp(
  idOrAlias: string,
  options: { port?: number; env?: Record<string, string> } = {}
): Promise<App> {
  await stopApp(idOrAlias);
  // Small delay to let port be released
  await new Promise(r => setTimeout(r, 1000));
  return startApp(idOrAlias, options);
}

/** Get logs for an app. */
export function getAppLogs(idOrAlias: string, lines: number = 50): string {
  const app = findApp(idOrAlias);
  if (!app) throw new Error(`App not found: ${idOrAlias}`);

  const logFile = paths.appLog(app.owner, app.repo);
  return readLogs(logFile, lines);
}

/** Sync status of all apps (check if PIDs are still alive). */
export function syncStatuses(): void {
  const apps = listApps();

  for (const app of apps) {
    if (app.status === 'running' && app.pid) {
      if (!isProcessRunning(app.pid)) {
        updateAppStatus(app.id, 'stopped');
        logger.info(`App ${app.fullName} (PID: ${app.pid}) is no longer running, marked as stopped`);
      }
    }
  }
}
