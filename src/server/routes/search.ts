import { Router } from 'express';
import { searchRepos } from '../../core/github.js';
import { asyncHandler } from '../middleware.js';

export const searchRouter = Router();

searchRouter.get('/', asyncHandler(async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    res.status(400).json({ error: 'Missing query parameter "q"' });
    return;
  }

  const language = req.query.language as string | undefined;
  const minStars = req.query.minStars ? parseInt(req.query.minStars as string, 10) : undefined;
  const topic = req.query.topic as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

  const results = await searchRepos(query, { language, minStars, topic, limit });
  res.json(results);
}));
