import { Router } from 'express';
import { listApps, findApp, getAppEnv, setAppEnvBulk, deleteAppEnvVar } from '../../core/registry.js';
import { installApp, updateApp, uninstallApp } from '../../core/installer.js';
import { startApp, stopApp, restartApp } from '../../core/lifecycle.js';
import { isProcessRunning } from '../../utils/process-manager.js';
import { updateAppStatus } from '../../core/registry.js';

export const appsRouter = Router();

// List installed apps
appsRouter.get('/', (req, res) => {
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Get single app
appsRouter.get('/:id', (req, res) => {
  try {
    const app = findApp(req.params.id);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    res.json(app);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Install an app
appsRouter.post('/install', async (req, res) => {
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Start an app
appsRouter.post('/:id/start', async (req, res) => {
  try {
    const { port, env } = req.body as { port?: number; env?: Record<string, string> };
    // Strip dangerous env vars that could enable code injection
    const BLOCKED_ENV = new Set(['PATH', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'LD_LIBRARY_PATH', 'NODE_OPTIONS', 'PYTHONPATH', 'RUBYOPT']);
    const safeEnv = env ? Object.fromEntries(
      Object.entries(env).filter(([k]) => !BLOCKED_ENV.has(k.toUpperCase()))
    ) : undefined;
    const app = await startApp(req.params.id, { port, env: safeEnv });
    res.json(app);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Stop an app
appsRouter.post('/:id/stop', async (req, res) => {
  try {
    const app = await stopApp(req.params.id);
    res.json(app);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Restart an app
appsRouter.post('/:id/restart', async (req, res) => {
  try {
    const app = await restartApp(req.params.id);
    res.json(app);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Update an app
appsRouter.post('/:id/update', async (req, res) => {
  try {
    const app = await updateApp(req.params.id);
    res.json(app);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Uninstall an app
appsRouter.delete('/:id', async (req, res) => {
  try {
    const keepData = req.query.keepData === 'true';
    await uninstallApp(req.params.id, keepData);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Get env vars for an app
appsRouter.get('/:id/env', (req, res) => {
  try {
    const app = findApp(req.params.id);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    const vars = getAppEnv(app.id).map(v =>
      v.isSecret ? { ...v, value: '••••••••' } : v
    );
    res.json({ vars });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Set env vars for an app
appsRouter.put('/:id/env', (req, res) => {
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Delete a single env var
appsRouter.delete('/:id/env/:key', (req, res) => {
  try {
    const app = findApp(req.params.id);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    deleteAppEnvVar(app.id, req.params.key);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
