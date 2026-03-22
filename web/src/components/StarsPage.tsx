import { useNavigate } from 'react-router-dom';
import { useStars } from '../hooks/useStars';
import { formatStars, langColors, githubAvatarUrl } from '../utils/format';

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
            <div
              key={repo.fullName}
              onClick={() => navigate(`/app/${repo.owner}/${repo.name}`)}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <img
                  src={githubAvatarUrl(repo.owner)}
                  alt={repo.owner}
                  className="w-11 h-11 rounded-xl shadow-md"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-white font-semibold text-sm truncate">{repo.name}</h3>
                    <span className="flex items-center gap-1 text-yellow-400/80 text-xs shrink-0 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      {formatStars(repo.stars)}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5 truncate">{repo.owner}</p>
                  <p className="text-gray-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                    {repo.description ?? 'No description'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 ml-14">
                {repo.language && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className={`w-2 h-2 rounded-full ${langColors[repo.language] ?? 'bg-gray-500'}`} />
                    {repo.language}
                  </span>
                )}
              </div>
            </div>
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
