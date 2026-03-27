import { Router } from 'express';
import { createSuggestion, listSuggestions } from '../../core/registry.js';
import { asyncHandler } from '../middleware.js';

export const suggestionsRouter = Router();

// Create a suggestion
suggestionsRouter.post('/', asyncHandler(async (req, res) => {
  const { type, url, categoryId, note } = req.body as {
    type: 'repo' | 'source';
    url: string;
    categoryId?: string;
    note?: string;
  };

  if (!type || !url) {
    res.status(400).json({ error: 'Missing "type" and "url" in request body' });
    return;
  }

  if (type !== 'repo' && type !== 'source') {
    res.status(400).json({ error: '"type" must be "repo" or "source"' });
    return;
  }

  const suggestion = createSuggestion(type, url, categoryId, note);
  res.json({ suggestion });
}));

// List suggestions
suggestionsRouter.get('/', asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const suggestions = listSuggestions(status);
  res.json({ suggestions });
}));
