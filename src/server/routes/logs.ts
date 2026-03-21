import { Router } from 'express';
import { getAppLogs } from '../../core/lifecycle.js';
import { findApp } from '../../core/registry.js';

export const logsRouter = Router();

// This is mounted under /api/logs but also accessible via /api/apps/:id/logs
logsRouter.get('/:id', (req, res) => {
  try {
    const app = findApp(req.params.id);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    const lines = parseInt(req.query.lines as string ?? '50', 10);
    const logs = getAppLogs(req.params.id, lines);
    res.json({ app: app.fullName, logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
