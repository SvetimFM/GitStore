import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type UserList, type UserListItem } from '../api/client';
import { githubAvatarUrl } from '../utils/format';

export function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [list, setList] = useState<UserList | null>(null);
  const [items, setItems] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingRepo, setRemovingRepo] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getList(id);
      setList(data.list);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load list');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleRemove = async (repoFullName: string) => {
    if (!id) return;
    setRemovingRepo(repoFullName);
    try {
      await api.removeFromList(id, repoFullName);
      setItems(prev => prev.filter(i => i.repoFullName !== repoFullName));
      setList(prev => prev ? { ...prev, itemCount: prev.itemCount - 1 } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove repo');
    } finally {
      setRemovingRepo(null);
    }
  };

  const handleDeleteList = async () => {
    if (!id || !list) return;
    if (!confirm(`Delete list "${list.name}"? This cannot be undone.`)) return;

    try {
      await api.deleteList(id);
      navigate('/lists');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete list');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-lg animate-shimmer" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[80px] rounded-xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-400 text-lg">List not found</p>
        <button
          onClick={() => navigate('/lists')}
          className="mt-4 px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-full text-sm font-medium transition-all"
        >
          Back to Lists
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/lists')}
            className="text-gray-500 hover:text-white transition-colors"
            title="Back to lists"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-3xl">{list.icon}</span>
          <div>
            <h1 className="text-xl font-semibold text-white">{list.name}</h1>
            {list.description && (
              <p className="text-gray-500 text-sm mt-0.5">{list.description}</p>
            )}
            <p className="text-gray-600 text-xs mt-1">
              {list.itemCount} {list.itemCount === 1 ? 'repo' : 'repos'}
            </p>
          </div>
        </div>
        <button
          onClick={handleDeleteList}
          className="text-gray-600 hover:text-red-400 transition-colors p-2"
          title="Delete list"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">&#128230;</div>
          <p className="text-gray-400 text-lg">This list is empty</p>
          <p className="text-gray-600 text-sm mt-1">Add repos from the store, search results, or your stars</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const [owner, repo] = item.repoFullName.split('/');
            return (
              <div
                key={item.id}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-200 group flex items-center gap-4"
              >
                <img
                  src={githubAvatarUrl(owner)}
                  alt={owner}
                  className="w-10 h-10 rounded-xl shadow-md cursor-pointer"
                  loading="lazy"
                  onClick={() => navigate(`/app/${owner}/${repo}`)}
                />
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/app/${owner}/${repo}`)}
                >
                  <h3 className="text-white font-semibold text-sm truncate">{item.repoFullName}</h3>
                  {item.note && (
                    <p className="text-gray-500 text-xs mt-0.5 truncate">{item.note}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(item.repoFullName)}
                  disabled={removingRepo === item.repoFullName}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1.5 opacity-0 group-hover:opacity-100 shrink-0"
                  title="Remove from list"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
