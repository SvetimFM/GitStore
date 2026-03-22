import { Router } from 'express';
import {
  getCategories,
  getCollections,
  getCollection,
  enrichCollectionRepos,
  enrichFeatured,
} from '../../core/collections.js';
import { curateFromSource, curateAll, fetchAwesomeList, PREDEFINED_SOURCES, type CurateSource } from '../../core/curate.js';

export const collectionsRouter = Router();

// GET / — list categories and collections (optionally filtered by categoryId)
collectionsRouter.get('/', (req, res) => {
  try {
    const categoryId = req.query.categoryId as string | undefined;
    const categories = getCategories();
    const collections = getCollections(categoryId);
    res.json({ categories, collections });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /featured — enriched featured apps
collectionsRouter.get('/featured', async (_req, res) => {
  try {
    const featured = await enrichFeatured();
    res.json({ featured });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /categories/:id — category detail with its collections
collectionsRouter.get('/categories/:id', (req, res) => {
  try {
    const categories = getCategories();
    const category = categories.find(c => c.id === req.params.id);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const collections = getCollections(req.params.id);
    res.json({ category, collections });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /curate/sources — list predefined curate sources
collectionsRouter.get('/curate/sources', (_req, res) => {
  res.json({ sources: PREDEFINED_SOURCES });
});

// POST /curate — curate from an awesome-list
collectionsRouter.post('/curate', async (req, res) => {
  try {
    const body = req.body as { repo?: string; categoryId?: string; all?: boolean };

    if (body.all) {
      const results = await curateAll();
      res.json({ results });
      return;
    }

    if (!body.repo) {
      res.status(400).json({ error: 'repo is required (or set all: true)' });
      return;
    }
    // Validate repo format: must be owner/repo with safe characters
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(body.repo)) {
      res.status(400).json({ error: 'Invalid repo format. Use owner/repo.' });
      return;
    }

    if (!body.categoryId) {
      // Preview mode: return parsed sections
      const sections = await fetchAwesomeList(body.repo);
      res.json({ preview: true, repo: body.repo, sections: sections.map(s => ({ name: s.name, repoCount: s.repos.length })) });
      return;
    }

    const source: CurateSource = {
      repo: body.repo,
      categoryId: body.categoryId,
      maxReposPerSection: 6,
      minReposPerSection: 2,
    };
    const result = await curateFromSource(source);
    res.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /:id — enriched collection detail
collectionsRouter.get('/:id', async (req, res) => {
  try {
    const collection = getCollection(req.params.id);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }
    const enriched = await enrichCollectionRepos(collection);
    res.json(enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
