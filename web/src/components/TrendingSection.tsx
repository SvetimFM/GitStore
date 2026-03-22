import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrending } from '../hooks/useTrending';
import { formatStars, langColors, githubAvatarUrl } from '../utils/format';

const periods = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
] as const;

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

export function TrendingSection() {
  const [since, setSince] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const { repos, loading, error } = useTrending(since);
  const navigate = useNavigate();

  const displayRepos = repos.slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Trending</h2>
        <div className="flex items-center gap-1 bg-white/5 rounded-full p-0.5">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setSince(p.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                since === p.key
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[140px] rounded-xl animate-shimmer" />
          ))}
        </div>
      )}

      {!loading && !error && displayRepos.length === 0 && (
        <p className="text-gray-500 text-sm py-4">No trending repos found for this period.</p>
      )}

      {!loading && displayRepos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayRepos.map((repo) => (
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
                {repo.createdAt && (
                  <span className="text-xs text-gray-600">
                    Created {timeAgo(repo.createdAt)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
