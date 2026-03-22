import { Router } from 'express';
import { getReadme, renderMarkdown, getLatestRelease } from '../../core/github.js';

export const readmeRouter = Router();

// In-memory cache with 10-minute TTL
const cache = new Map<string, { html: string; expires: number }>();
const TTL = 10 * 60 * 1000; // 10 minutes

// GET /:owner/:repo/readme — rendered README HTML
readmeRouter.get('/:owner/:repo/readme', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const key = `${owner}/${repo}`;

    // Check cache
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      res.json({ html: cached.html });
      return;
    }

    // Fetch and render
    const content = await getReadme(owner, repo);
    if (!content) {
      res.json({ html: null });
      return;
    }

    const html = await renderMarkdown(content, `${owner}/${repo}`);
    if (!html) {
      res.json({ html: null });
      return;
    }

    // Store in cache
    cache.set(key, { html, expires: Date.now() + TTL });

    res.json({ html });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /:owner/:repo/releases — latest release info
readmeRouter.get('/:owner/:repo/releases', async (req, res) => {
  try {
    const release = await getLatestRelease(req.params.owner, req.params.repo);
    res.json({ release });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
