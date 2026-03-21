import { Router } from 'express';
import { inspectRepo } from '../../core/installer.js';

export const inspectRouter = Router();

inspectRouter.get('/:owner/:repo', async (req, res) => {
  try {
    const repoStr = `${req.params.owner}/${req.params.repo}`;
    const result = await inspectRepo(repoStr);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
