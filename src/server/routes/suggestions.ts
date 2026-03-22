import { Router } from 'express';
import { createSuggestion, listSuggestions } from '../../core/registry.js';

export const suggestionsRouter = Router();

// Create a suggestion
suggestionsRouter.post('/', (req, res) => {
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// List suggestions
suggestionsRouter.get('/', (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const suggestions = listSuggestions(status);
    res.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
