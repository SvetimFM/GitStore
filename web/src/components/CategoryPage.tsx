import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Category, type CollectionSummary } from '../api/client';
import { githubAvatarUrl } from '../utils/format';

export function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | null>(null);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getCategoryDetail(id!);
        if (!cancelled) {
          setCategory(data.category);
          setCollections(data.collections);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load category');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 rounded-xl animate-shimmer" />
        <div className="h-5 w-72 rounded-lg animate-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-20 rounded-xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (!category) {
    return <div className="text-gray-400 text-center py-12">Category not found</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 text-sm hover:text-white transition-colors mb-6 flex items-center gap-1.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Store
        </button>
        <div className="flex items-center gap-4">
          <span className="text-5xl">{category.icon}</span>
          <div>
            <h1 className="text-3xl font-bold text-white">{category.name}</h1>
            <p className="text-gray-400 mt-1">{category.description}</p>
          </div>
        </div>
      </div>

      {collections.map(collection => (
        <div key={collection.id} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{collection.name}</h2>
            {collection.description && (
              <p className="text-gray-500 text-sm mt-0.5">{collection.description}</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {collection.repos.map(repo => {
              const [owner, repoName] = repo.fullName.split('/');
              return (
                <div
                  key={repo.fullName}
                  onClick={() => navigate(`/app/${owner}/${repoName}`)}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 cursor-pointer group flex items-center gap-3"
                >
                  <img
                    src={githubAvatarUrl(owner)}
                    alt={owner}
                    className="w-10 h-10 rounded-xl"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm truncate">{repoName}</h3>
                    {repo.note && (
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{repo.note}</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
