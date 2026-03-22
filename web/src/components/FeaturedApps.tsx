import { useNavigate } from 'react-router-dom';
import type { FeaturedAppInfo } from '../api/client';
import { formatStars, githubAvatarUrl } from '../utils/format';

interface FeaturedAppsProps {
  apps: FeaturedAppInfo[];
  loading?: boolean;
}

const cardThemes = [
  { gradient: 'from-blue-600/20 to-purple-600/20', border: 'border-blue-500/20' },
  { gradient: 'from-emerald-600/20 to-teal-600/20', border: 'border-emerald-500/20' },
  { gradient: 'from-orange-600/20 to-rose-600/20', border: 'border-orange-500/20' },
  { gradient: 'from-violet-600/20 to-fuchsia-600/20', border: 'border-violet-500/20' },
  { gradient: 'from-cyan-600/20 to-blue-600/20', border: 'border-cyan-500/20' },
  { gradient: 'from-rose-600/20 to-pink-600/20', border: 'border-rose-500/20' },
  { gradient: 'from-amber-600/20 to-orange-600/20', border: 'border-amber-500/20' },
  { gradient: 'from-teal-600/20 to-emerald-600/20', border: 'border-teal-500/20' },
];

export function FeaturedApps({ apps, loading }: FeaturedAppsProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-5">
        <h2 className="text-xl font-semibold text-white">Featured</h2>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="min-w-[300px] h-[180px] rounded-2xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (apps.length === 0) return null;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">Featured</h2>
      <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
        {apps.map((app, i) => {
          const [owner, repo] = app.fullName.split('/');
          const theme = cardThemes[i % cardThemes.length];
          return (
            <div
              key={app.fullName}
              onClick={() => navigate(`/app/${owner}/${repo}`)}
              className={`min-w-[300px] max-w-[340px] bg-gradient-to-br ${theme.gradient} border ${theme.border} rounded-2xl p-5 hover:scale-[1.02] transition-all duration-200 cursor-pointer shrink-0 flex flex-col group`}
            >
              <div className="flex items-start gap-3">
                <img
                  src={githubAvatarUrl(owner)}
                  alt={owner}
                  className="w-12 h-12 rounded-xl shadow-lg"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm truncate">{repo}</h3>
                  <p className="text-gray-400 text-xs truncate">{owner}</p>
                </div>
                {app.info && (
                  <span className="flex items-center gap-1 text-yellow-400/80 text-xs shrink-0 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    {formatStars(app.info.stars)}
                  </span>
                )}
              </div>
              <p className="text-gray-300/80 text-sm mt-3 line-clamp-2 flex-1 leading-relaxed">
                {app.tagline ?? app.info?.description ?? 'No description'}
              </p>
              {app.info?.language && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-gray-500">{app.info.language}</span>
                  <span className="text-xs font-medium text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    View details →
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
