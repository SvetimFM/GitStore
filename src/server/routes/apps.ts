import { Router } from 'express';
import { listApps, findApp, getAppEnv, setAppEnvBulk, deleteAppEnvVar } from '../../core/registry.js';
import { installApp, updateApp, uninstallApp } from '../../core/installer.js';
import { startApp, stopApp, restartApp } from '../../core/lifecycle.js';
import { isProcessRunning } from '../../utils/process-manager.js';
import { updateAppStatus } from '../../core/registry.js';
import { asyncHandler } from '../middleware.js';

export const appsRouter = Router();

// List installed apps
appsRouter.get('/', asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const apps = listApps(status === 'all' ? undefined : status as any);

  // Sync running statuses
  for (const app of apps) {
    if (app.status === 'running' && app.pid && !isProcessRunning(app.pid)) {
      updateAppStatus(app.id, 'stopped');
      app.status = 'stopped';
      app.pid = null;
    }
  }

  res.json({ apps });
}));

// Get single app
appsRouter.get('/:id', asyncHandler(async (req, res) => {
  const app = findApp(req.params.id);
  if (!app) {
    res.status(404).json({ error: 'App not found' });
    return;
  }
  res.json(app);
}));

// Install an app
appsRouter.post('/install', asyncHandler(async (req, res) => {
  const { repo, alias, ref } = req.body as { repo: string; alias?: string; ref?: string };
  if (!repo) {
    res.status(400).json({ error: 'Missing "repo" in request body' });
    return;
  }
  // Validate ref: must not start with '-' (prevents git argument injection)
  if (ref && (ref.startsWith('-') || !/^[a-zA-Z0-9_./-]+$/.test(ref))) {
    res.status(400).json({ error: 'Invalid ref format' });
    return;
  }

  const result = await installApp(repo, { alias, ref });
  res.json(result);
}));

// Start an app
appsRouter.post('/:id/start', asyncHandler(async (req, res) => {
  const { port, env } = req.body as { port?: number; env?: Record<string, string> };
  // Strip dangerous env vars that could enable code injection
  const BLOCKED_ENV = new Set([
    'PATH', 'HOME', 'SHELL', 'USER', 'LOGNAME',
    'LD_PRELOAD', 'LD_AUDIT', 'LD_LIBRARY_PATH', 'LD_BIND_NOW', 'LD_DEBUG',
    'DYLD_INSERT_LIBRARIES', 'DYLD_LIBRARY_PATH', 'DYLD_FRAMEWORK_PATH',
    'NODE_OPTIONS', 'NODE_PATH',
    'PYTHONPATH', 'PYTHONHOME', 'PYTHONSTARTUP',
    'RUBYOPT', 'RUBYLIB',
    'PERL5LIB', 'PERLLIB',
    'JAVA_TOOL_OPTIONS', '_JAVA_OPTIONS',
    'GLIBC_TUNABLES', 'MALLOC_CHECK_',
  ]);
  const safeEnv = env ? Object.fromEntries(
    Object.entries(env).filter(([k]) => !BLOCKED_ENV.has(k.toUpperCase()))
  ) : undefined;
  const app = await startApp(req.params.id, { port, env: safeEnv });
  res.json(app);
}));

// Stop an app
appsRouter.post('/:id/stop', asyncHandler(async (req, res) => {
  const app = await stopApp(req.params.id);
  res.json(app);
}));

// Restart an app
appsRouter.post('/:id/restart', asyncHandler(async (req, res) => {
  const app = await restartApp(req.params.id);
  res.json(app);
}));

// Update an app
appsRouter.post('/:id/update', asyncHandler(async (req, res) => {
  const app = await updateApp(req.params.id);
  res.json(app);
}));

// Uninstall an app
appsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const keepData = req.query.keepData === 'true';
  await uninstallApp(req.params.id, keepData);
  res.json({ success: true });
}));

// Get env vars for an app
appsRouter.get('/:id/env', asyncHandler(async (req, res) => {
  const app = findApp(req.params.id);
  if (!app) {
    res.status(404).json({ error: 'App not found' });
    return;
  }
  const vars = getAppEnv(app.id).map(v =>
    v.isSecret ? { ...v, value: '••••••••' } : v
  );
  res.json({ vars });
}));

// Set env vars for an app
appsRouter.put('/:id/env', asyncHandler(async (req, res) => {
  const app = findApp(req.params.id);
  if (!app) {
    res.status(404).json({ error: 'App not found' });
    return;
  }
  const { vars, secret } = req.body as { vars: Record<string, string>; secret?: boolean };
  if (!vars || typeof vars !== 'object') {
    res.status(400).json({ error: 'Missing "vars" in request body' });
    return;
  }
  setAppEnvBulk(app.id, vars, secret ?? false);
  const allVars = getAppEnv(app.id);
  res.json({ vars: allVars });
}));

// Delete a single env var
appsRouter.delete('/:id/env/:key', asyncHandler(async (req, res) => {
  const app = findApp(req.params.id);
  if (!app) {
    res.status(404).json({ error: 'App not found' });
    return;
  }
  deleteAppEnvVar(app.id, req.params.key);
  res.json({ success: true });
}));
