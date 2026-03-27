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
import { asyncHandler } from '../middleware.js';

export const listsRouter = Router();

// GET / — list all user lists
listsRouter.get('/', asyncHandler(async (_req, res) => {
  const lists = listUserLists();
  res.json({ lists });
}));

// POST / — create a new list
listsRouter.post('/', asyncHandler(async (req, res) => {
  const { name, description, icon } = req.body as { name?: string; description?: string; icon?: string };
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const list = createUserList(name, description, icon);
  res.json({ list });
}));

// GET /:id — get a single list with its items
listsRouter.get('/:id', asyncHandler(async (req, res) => {
  const list = getUserList(req.params.id);
  if (!list) {
    res.status(404).json({ error: 'List not found' });
    return;
  }

  const items = getUserListItems(req.params.id);
  res.json({ list, items });
}));

// DELETE /:id — delete a list
listsRouter.delete('/:id', asyncHandler(async (req, res) => {
  deleteUserList(req.params.id);
  res.json({ success: true });
}));

// POST /:id/items — add a repo to a list
listsRouter.post('/:id/items', asyncHandler(async (req, res) => {
  const { repoFullName, note } = req.body as { repoFullName?: string; note?: string };
  if (!repoFullName || typeof repoFullName !== 'string') {
    res.status(400).json({ error: 'repoFullName is required' });
    return;
  }

  addToUserList(req.params.id, repoFullName, note);
  res.json({ success: true });
}));

// DELETE /:id/items/:repoFullName — remove a repo from a list
listsRouter.delete('/:id/items/:repoFullName', asyncHandler(async (req, res) => {
  removeFromUserList(req.params.id, decodeURIComponent(req.params.repoFullName));
  res.json({ success: true });
}));
