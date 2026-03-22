import { Router } from 'express';
import { getTrending } from '../../core/trending.js';

export const trendingRouter = Router();

// GET / — trending repos
trendingRouter.get('/', async (req, res) => {
  try {
    const since = (req.query.since as string) ?? 'daily';
    const language = req.query.language as string | undefined;

    if (!['daily', 'weekly', 'monthly'].includes(since)) {
      res.status(400).json({ error: 'since must be daily, weekly, or monthly' });
      return;
    }

    const repos = await getTrending({
      since: since as 'daily' | 'weekly' | 'monthly',
      language: language || undefined,
    });

    res.json({ repos });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
