import { Router } from 'express';
import { getTrending } from '../../core/trending.js';
import { asyncHandler } from '../middleware.js';

export const trendingRouter = Router();

// GET / — trending repos
trendingRouter.get('/', asyncHandler(async (req, res) => {
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
}));
