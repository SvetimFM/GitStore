import { useState } from 'react';
import { useTrending } from '../hooks/useTrending';
import { formatTimeAgo } from '../utils/format';
import { RepoCard } from './RepoCard';

const periods = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
] as const;

export function TrendingSection() {
  const [since, setSince] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const { repos, loading, error } = useTrending(since);

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
            <RepoCard
              key={repo.fullName}
              owner={repo.owner}
              name={repo.name}

              description={repo.description}
              stars={repo.stars}
              language={repo.language}
              extra={repo.createdAt ? (
                <span className="text-xs text-gray-600">
                  Created {formatTimeAgo(repo.createdAt)}
                </span>
              ) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
