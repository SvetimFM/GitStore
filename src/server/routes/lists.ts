import { Router } from 'express';
import {
  createUserList,
  listUserLists,
  getUserList,
  deleteUserList,
  addToUserList,
  removeFromUserList,
  getUserListItems,
} from '../../core/registry.js';

export const listsRouter = Router();

// GET / — list all user lists
listsRouter.get('/', (_req, res) => {
  try {
    const lists = listUserLists();
    res.json({ lists });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// POST / — create a new list
listsRouter.post('/', (req, res) => {
  try {
    const { name, description, icon } = req.body as { name?: string; description?: string; icon?: string };
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const list = createUserList(name, description, icon);
    res.json({ list });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /:id — get a single list with its items
listsRouter.get('/:id', (req, res) => {
  try {
    const list = getUserList(req.params.id);
    if (!list) {
      res.status(404).json({ error: 'List not found' });
      return;
    }

    const items = getUserListItems(req.params.id);
    res.json({ list, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// DELETE /:id — delete a list
listsRouter.delete('/:id', (req, res) => {
  try {
    deleteUserList(req.params.id);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// POST /:id/items — add a repo to a list
listsRouter.post('/:id/items', (req, res) => {
  try {
    const { repoFullName, note } = req.body as { repoFullName?: string; note?: string };
    if (!repoFullName || typeof repoFullName !== 'string') {
      res.status(400).json({ error: 'repoFullName is required' });
      return;
    }

    addToUserList(req.params.id, repoFullName, note);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// DELETE /:id/items/:repoFullName — remove a repo from a list
listsRouter.delete('/:id/items/:repoFullName', (req, res) => {
  try {
    removeFromUserList(req.params.id, decodeURIComponent(req.params.repoFullName));
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
