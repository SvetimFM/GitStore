import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { searchRouter } from './routes/search.js';
import { appsRouter } from './routes/apps.js';
import { inspectRouter } from './routes/inspect.js';
import { logsRouter } from './routes/logs.js';
import { ensureDirs } from '../utils/paths.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createExpressApp() {
  ensureDirs();

  const app = express();
  app.use(express.json());

  // API routes
  app.use('/api/search', searchRouter);
  app.use('/api/apps', appsRouter);
  app.use('/api/inspect', inspectRouter);
  app.use('/api/logs', logsRouter);

  // Serve static frontend (production)
  const webDist = join(__dirname, '../../web/dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  return app;
}

// Direct execution
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const app = createExpressApp();
app.listen(PORT, () => {
  logger.info(`GitStore server running at http://localhost:${PORT}`);
});
