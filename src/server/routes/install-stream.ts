import { Router } from 'express';
import type { Response } from 'express';
import { runInstallPipeline } from '../../core/install-pipeline.js';
import { logger } from '../../utils/logger.js';

export const installStreamRouter = Router();

function send(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

installStreamRouter.get('/install-stream', async (req, res) => {
  const repoStr = req.query.repo as string;
  if (!repoStr) {
    res.status(400).json({ error: 'repo query param required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    const result = await runInstallPipeline(repoStr, {}, {
      onStatus(step, message, extra) {
        send(res, 'status', { step, message, ...extra });
      },
      onOutput(stream, text) {
        send(res, 'output', { stream, text });
      },
    });

    send(res, 'complete', { app: result.app });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Install stream error: ${message}`);
    send(res, 'error', { message });
  }

  res.end();
});
