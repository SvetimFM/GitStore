import type { RepoInfo } from '../api/client';

interface AppCardProps {
  repo: RepoInfo;
  onInstall: (repo: RepoInfo) => void;
  onInspect: (repo: RepoInfo) => void;
  installing?: boolean;
}

function formatStars(stars: number): string {
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
  return String(stars);
}

const langColors: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-500',
  Python: 'bg-green-500',
  Rust: 'bg-orange-500',
  Go: 'bg-cyan-500',
  Java: 'bg-red-500',
  'C++': 'bg-pink-500',
  Ruby: 'bg-red-400',
};

export function AppCard({ repo, onInstall, onInspect, installing }: AppCardProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{repo.fullName}</h3>
          <p className="text-gray-400 text-sm mt-1 line-clamp-2">
            {repo.description ?? 'No description'}
          </p>
        </div>
        <div className="flex items-center gap-1 text-yellow-400 text-sm shrink-0">
          <span>★</span>
          <span>{formatStars(repo.stars)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {repo.language && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${langColors[repo.language] ?? 'bg-gray-500'}`} />
            {repo.language}
          </span>
        )}
        {repo.license && (
          <span className="text-xs text-gray-500">{repo.license}</span>
        )}
        {repo.isArchived && (
          <span className="text-xs text-yellow-600 bg-yellow-900/30 px-1.5 py-0.5 rounded">Archived</span>
        )}
      </div>

      {repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {repo.topics.slice(0, 4).map(t => (
            <span key={t} className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onInspect(repo)}
          className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
        >
          Inspect
        </button>
        <button
          onClick={() => onInstall(repo)}
          disabled={installing}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {installing ? 'Installing...' : 'Install'}
        </button>
      </div>
    </div>
  );
}
