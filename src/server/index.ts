import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { searchRouter } from './routes/search.js';
import { appsRouter } from './routes/apps.js';
import { inspectRouter } from './routes/inspect.js';
import { logsRouter } from './routes/logs.js';
import { collectionsRouter } from './routes/collections.js';
import { readmeRouter } from './routes/readme.js';
import { suggestionsRouter } from './routes/suggestions.js';
import { trendingRouter } from './routes/trending.js';
import { configRouter } from './routes/config.js';
import { ensureDirs } from '../utils/paths.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createExpressApp() {
  ensureDirs();

  const app = express();
  app.use(express.json());

  // CORS — allow Tauri webview and local dev origins
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  // API routes
  app.use('/api/search', searchRouter);
  app.use('/api/apps', appsRouter);
  app.use('/api/inspect', inspectRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/collections', collectionsRouter);
  app.use('/api/repos', readmeRouter);
  app.use('/api/trending', trendingRouter);
  app.use('/api/suggestions', suggestionsRouter);
  app.use('/api/config', configRouter);

  // Serve static frontend (production)
  // Check multiple locations: standard dev path and Tauri bundle path
  const webDistCandidates = [
    join(__dirname, '../../web/dist'),     // dev: dist/server/ -> web/dist/
    join(__dirname, '../web-dist'),         // bundled: backend/server/ -> backend/web-dist/
  ];
  const webDist = webDistCandidates.find(p => existsSync(join(p, 'index.html')));
  if (webDist) {
    app.use(express.static(webDist));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  return app;
}
