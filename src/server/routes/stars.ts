import { Router } from 'express';
import { getStarredRepos, getAuthenticatedUser } from '../../core/github.js';

export const starsRouter = Router();

// GET /stars?page=1&perPage=30 — list user's starred repos
starsRouter.get('/stars', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const perPage = Math.min(Math.max(1, parseInt(req.query.perPage as string, 10) || 30), 100);

    const result = await getStarredRepos(page, perPage);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /user — check authenticated user
starsRouter.get('/user', async (_req, res) => {
  try {
    const user = await getAuthenticatedUser();
    if (user) {
      res.json({ authenticated: true, user });
    } else {
      res.json({ authenticated: false });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
