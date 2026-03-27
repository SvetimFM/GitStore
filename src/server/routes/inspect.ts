import { Router } from 'express';
import { inspectRepo } from '../../core/installer.js';
import { asyncHandler } from '../middleware.js';

export const inspectRouter = Router();

inspectRouter.get('/:owner/:repo', asyncHandler(async (req, res) => {
  const repoStr = `${req.params.owner}/${req.params.repo}`;
  const result = await inspectRepo(repoStr);
  res.json(result);
}));
