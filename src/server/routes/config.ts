import { Router } from 'express';
import { getGithubToken, setGithubToken, removeGithubToken } from '../../core/config.js';
import { getRateLimit } from '../../core/github.js';

export const configRouter = Router();

// GET /github-token — check if a token is configured
configRouter.get('/github-token', (_req, res) => {
  try {
    const token = getGithubToken();
    res.json({ hasToken: !!token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// PUT /github-token — set a new token (validates via rate limit check)
configRouter.put('/github-token', async (req, res) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    // Temporarily save the token, then validate it
    setGithubToken(token);

    try {
      await getRateLimit();
    } catch {
      // Token is invalid — remove it
      removeGithubToken();
      res.status(400).json({ error: 'Invalid token — could not authenticate with GitHub API' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// DELETE /github-token — remove the configured token
configRouter.delete('/github-token', (_req, res) => {
  try {
    removeGithubToken();
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /rate-limit — current GitHub API rate limit status
configRouter.get('/rate-limit', async (_req, res) => {
  try {
    const rateLimit = await getRateLimit();
    res.json(rateLimit);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
