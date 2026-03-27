import { useNavigate } from 'react-router-dom';
import { useStars } from '../hooks/useStars';
import { RepoCard } from './RepoCard';

export function StarsPage() {
  const { repos, loading, error, hasMore, loadMore, loadingMore, authenticated, user } = useStars();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-lg animate-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[140px] rounded-xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="text-center py-24">
        <div className="text-5xl mb-4">&#11088;</div>
        <h2 className="text-xl font-semibold text-white mb-2">See Your Starred Repos</h2>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          Add a GitHub personal access token in Settings to view and browse your starred repositories.
        </p>
        <button
          onClick={() => navigate('/settings')}
          className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-full text-sm font-medium transition-all"
        >
          Go to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User header */}
      {user && (
        <div className="flex items-center gap-4">
          <img
            src={user.avatarUrl}
            alt={user.login}
            className="w-12 h-12 rounded-full shadow-lg"
          />
          <div>
            <h1 className="text-xl font-semibold text-white">
              {user.name ?? user.login}'s Stars
            </h1>
            <p className="text-gray-500 text-sm">@{user.login}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {repos.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">&#11088;</div>
          <p className="text-gray-400 text-lg">No starred repos yet</p>
          <p className="text-gray-600 text-sm mt-1">Star repos on GitHub and they'll appear here</p>
        </div>
      )}

      {repos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repos.map((repo) => (
            <RepoCard
              key={repo.fullName}
              owner={repo.owner}
              name={repo.name}

              description={repo.description}
              stars={repo.stars}
              language={repo.language}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-8 py-2.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white rounded-full text-sm font-medium transition-all"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
