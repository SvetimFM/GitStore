import type { RepoInfo } from '../api/client';
import { formatStars, langColors, githubAvatarUrl } from '../utils/format';

interface AppCardProps {
  repo: RepoInfo;
  onInstall: (repo: RepoInfo) => void;
  onInspect: (repo: RepoInfo) => void;
  installing?: boolean;
}

export function AppCard({ repo, onInstall, onInspect, installing }: AppCardProps) {
  return (
    <div
      onClick={() => onInspect(repo)}
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
            <button
              onClick={(e) => { e.stopPropagation(); onInstall(repo); }}
              disabled={installing}
              className="px-3.5 py-1 text-xs font-semibold bg-blue-500 text-white rounded-full hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {installing ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : 'GET'}
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-0.5 truncate">{repo.owner}</p>
          <p className="text-gray-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
            {repo.description ?? 'No description'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 ml-14">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500/70"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          {formatStars(repo.stars)}
        </span>
        {repo.language && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${langColors[repo.language] ?? 'bg-gray-500'}`} />
            {repo.language}
          </span>
        )}
        {repo.license && (
          <span className="text-xs text-gray-600">{repo.license}</span>
        )}
        {repo.isArchived && (
          <span className="text-[10px] text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded-full font-medium">Archived</span>
        )}
      </div>

      {repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 ml-14">
          {repo.topics.slice(0, 3).map(t => (
            <span key={t} className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
