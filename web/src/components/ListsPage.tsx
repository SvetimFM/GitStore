import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type UserList } from '../api/client';

export function ListsPage() {
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadLists = useCallback(async () => {
    try {
      const data = await api.getLists();
      setLists(data.lists);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || creating) return;

    setCreating(true);
    try {
      await api.createList(formName.trim(), formDescription.trim() || undefined, formIcon.trim() || undefined);
      setFormName('');
      setFormDescription('');
      setFormIcon('');
      setShowForm(false);
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete list "${name}"? This cannot be undone.`)) return;

    setDeletingId(id);
    try {
      await api.deleteList(id);
      setLists(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete list');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 rounded-lg animate-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] rounded-xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">My Lists</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-full text-sm font-medium transition-all"
        >
          {showForm ? 'Cancel' : '+ Create New List'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., AI Tools, Weekend Projects"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-white/20 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="A short description for this list"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Icon (emoji)</label>
            <input
              type="text"
              value={formIcon}
              onChange={(e) => setFormIcon(e.target.value)}
              placeholder="Default: folder icon"
              className="w-24 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-white/20 transition-colors text-center"
              maxLength={4}
            />
          </div>
          <button
            type="submit"
            disabled={!formName.trim() || creating}
            className="px-6 py-2.5 bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 text-white rounded-full text-sm font-medium transition-all"
          >
            {creating ? 'Creating...' : 'Create List'}
          </button>
        </form>
      )}

      {lists.length === 0 && !showForm && (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">&#128203;</div>
          <h2 className="text-xl font-semibold text-white mb-2">No Lists Yet</h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create your first list to organize your favorite repos.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-full text-sm font-medium transition-all"
          >
            Create Your First List
          </button>
        </div>
      )}

      {lists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <div
              key={list.id}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-200 cursor-pointer group relative"
              onClick={() => navigate(`/lists/${list.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{list.icon}</span>
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold text-sm truncate">{list.name}</h3>
                    {list.description && (
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{list.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(list.id, list.name);
                  }}
                  disabled={deletingId === list.id}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100 shrink-0"
                  title="Delete list"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 ml-11">
                <span className="text-xs text-gray-600">
                  {list.itemCount} {list.itemCount === 1 ? 'repo' : 'repos'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
