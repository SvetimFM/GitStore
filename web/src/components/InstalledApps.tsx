import { useNavigate } from 'react-router-dom';
import { useApps } from '../hooks/useApps';
import { AppControls } from './AppControls';
import { githubAvatarUrl, formatStars, formatTimeAgo, langColors, runtimeIcons } from '../utils/format';

export function InstalledApps() {
  const { apps, loading, error, refresh } = useApps();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl animate-shimmer" />
        ))}
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

  if (apps.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl mx-auto mb-4">
          📦
        </div>
        <p className="text-gray-300 text-lg font-medium">No apps installed yet</p>
        <p className="text-gray-600 text-sm mt-1.5">Search the store to find and install apps</p>
      </div>
    );
  }

  const running = apps.filter(a => a.status === 'running');
  const other = apps.filter(a => a.status !== 'running');

  return (
    <div className="space-y-8">
      {/* Dashboard header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My Apps</h1>
          <p className="text-gray-500 text-sm mt-1">{apps.length} installed · {running.length} running</p>
        </div>
        <div className="flex items-center gap-3">
          {running.length > 0 && (
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {running.length} running
            </div>
          )}
        </div>
      </div>

      {/* Running apps */}
      {running.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Running</h2>
          <div className="grid gap-3">
            {running.map(app => (
              <div
                key={app.id}
                className="bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:border-emerald-500/20 transition-all cursor-pointer"
                onClick={() => navigate(`/my-apps/${app.id}`)}
              >
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={githubAvatarUrl(app.owner)}
                      alt={app.owner}
                      className="w-12 h-12 rounded-xl"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold text-sm truncate">{app.fullName}</h3>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-gray-500 text-xs flex items-center gap-1">
                          {runtimeIcons[app.runtime] ?? '📦'} {app.runtime}
                        </span>
                        {app.port && (
                          <>
                            <span className="text-gray-700 text-xs">·</span>
                            <a
                              href={`http://localhost:${app.port}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 text-xs hover:text-blue-300 transition-colors"
                              onClick={e => e.stopPropagation()}
                            >
                              localhost:{app.port}
                            </a>
                          </>
                        )}
                        {app.stars > 0 && (
                          <>
                            <span className="text-gray-700 text-xs">·</span>
                            <span className="text-gray-500 text-xs">★ {formatStars(app.stars)}</span>
                          </>
                        )}
                        {app.language && (
                          <>
                            <span className="text-gray-700 text-xs">·</span>
                            <span className="flex items-center gap-1 text-gray-500 text-xs">
                              <span className={`w-2 h-2 rounded-full ${langColors[app.language] ?? 'bg-gray-500'}`} />
                              {app.language}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0" onClick={e => e.stopPropagation()}>
                      <AppControls app={app} onUpdate={refresh} compact />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stopped / Installed */}
      {other.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {running.length > 0 ? 'Stopped' : 'Installed'}
          </h2>
          <div className="grid gap-3">
            {other.map(app => (
              <div
                key={app.id}
                className="bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:border-white/[0.1] transition-all cursor-pointer"
                onClick={() => navigate(`/my-apps/${app.id}`)}
              >
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={githubAvatarUrl(app.owner)}
                      alt={app.owner}
                      className="w-12 h-12 rounded-xl opacity-60"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-gray-300 font-semibold text-sm truncate">{app.fullName}</h3>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${app.status === 'error' ? 'bg-red-400' : 'bg-gray-600'}`} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-gray-600 text-xs flex items-center gap-1">
                          {runtimeIcons[app.runtime] ?? '📦'} {app.runtime}
                        </span>
                        {app.stars > 0 && (
                          <>
                            <span className="text-gray-700 text-xs">·</span>
                            <span className="text-gray-600 text-xs">★ {formatStars(app.stars)}</span>
                          </>
                        )}
                        {app.language && (
                          <>
                            <span className="text-gray-700 text-xs">·</span>
                            <span className="flex items-center gap-1 text-gray-600 text-xs">
                              <span className={`w-2 h-2 rounded-full ${langColors[app.language] ?? 'bg-gray-600'} opacity-60`} />
                              {app.language}
                            </span>
                          </>
                        )}
                        {app.installedAt && (
                          <>
                            <span className="text-gray-700 text-xs">·</span>
                            <span className="text-gray-600 text-xs">installed {formatTimeAgo(app.installedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0" onClick={e => e.stopPropagation()}>
                      <AppControls app={app} onUpdate={refresh} compact />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
