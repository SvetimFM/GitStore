import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type App, type AppEnvVar } from '../api/client';
import { githubAvatarUrl, formatStars, formatTimeAgo, langColors, runtimeIcons } from '../utils/format';
import { ReadmePreview } from '../components/ReadmePreview';
import { ReleaseInfo } from '../components/ReleaseInfo';
import { useAppDetail } from '../hooks/useAppDetail';

// ─── Status config ───

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  running:    { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Running' },
  installed:  { color: 'text-gray-400',    bg: 'bg-gray-500/10',    label: 'Installed' },
  stopped:    { color: 'text-gray-400',    bg: 'bg-gray-500/10',    label: 'Stopped' },
  error:      { color: 'text-red-400',     bg: 'bg-red-500/10',     label: 'Error' },
  installing: { color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Installing' },
};

// ─── Page ───

export function AppManagement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { app, loading, error, refresh } = useAppDetail(id!);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-2xl animate-shimmer" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-64 rounded-2xl animate-shimmer" />
          </div>
          <div className="space-y-6">
            <div className="h-48 rounded-2xl animate-shimmer" />
            <div className="h-48 rounded-2xl animate-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-3">❌</div>
        <p className="text-red-400 text-lg">{error ?? 'App not found'}</p>
        <button onClick={() => navigate('/my-apps')} className="text-blue-400 text-sm mt-3 hover:text-blue-300">
          ← Back to My Apps
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button onClick={() => navigate('/my-apps')} className="text-gray-500 text-sm hover:text-gray-300 transition-colors flex items-center gap-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        My Apps
      </button>

      {/* Header */}
      <AppHeader app={app} onAction={refresh} onNavigate={navigate} />

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <LogViewer appId={app.id} />
          <ReadmePreview owner={app.owner} repo={app.repo} />
        </div>
        <div className="space-y-6">
          <AppInfo app={app} />
          <VersionInfo app={app} />
          <EnvPanel appId={app.id} envVarsRequired={app.envVarsRequired} onSave={refresh} />
          <ReleaseInfo owner={app.owner} repo={app.repo} />
        </div>
      </div>
    </div>
  );
}

// ─── AppHeader ───

function AppHeader({ app, onAction, onNavigate }: { app: App; onAction: () => void; onNavigate: (path: string) => void }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const status = statusConfig[app.status] ?? statusConfig.installed;

  const doAction = async (name: string, fn: () => Promise<unknown>) => {
    setActionLoading(name);
    try {
      await fn();
      onAction();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
      <div className="flex items-start gap-5">
        <img src={githubAvatarUrl(app.owner)} alt={app.owner} className="w-16 h-16 rounded-xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white truncate">{app.fullName}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>
          {app.description && (
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">{app.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">{runtimeIcons[app.runtime] ?? '📦'} {app.runtime}</span>
            {app.port && <span>Port {app.port}</span>}
            {app.pid && <span>PID {app.pid}</span>}
            {app.installedAt && <span>Installed {formatTimeAgo(app.installedAt)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {app.status !== 'running' ? (
            <ActionButton onClick={() => doAction('start', () => api.start(app.id))} loading={actionLoading === 'start'} disabled={actionLoading !== null} className="bg-emerald-500 hover:bg-emerald-400 text-white">
              Start
            </ActionButton>
          ) : (
            <>
              <ActionButton onClick={() => doAction('stop', () => api.stop(app.id))} loading={actionLoading === 'stop'} disabled={actionLoading !== null} className="bg-red-500/10 text-red-400 hover:bg-red-500/20">
                Stop
              </ActionButton>
              <ActionButton onClick={() => doAction('restart', () => api.restart(app.id))} loading={actionLoading === 'restart'} disabled={actionLoading !== null} className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">
                Restart
              </ActionButton>
            </>
          )}
          <ActionButton onClick={() => doAction('update', () => api.update(app.id))} loading={actionLoading === 'update'} disabled={actionLoading !== null} className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
            Update
          </ActionButton>
          <ActionButton
            onClick={() => {
              if (confirm(`Uninstall ${app.fullName}? This will remove all files.`)) {
                doAction('uninstall', async () => { await api.uninstall(app.id); onNavigate('/my-apps'); });
              }
            }}
            loading={actionLoading === 'uninstall'}
            disabled={actionLoading !== null}
            className="bg-white/5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
          >
            Uninstall
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ onClick, loading: isLoading, disabled, className, children }: {
  onClick: () => void; loading?: boolean; disabled?: boolean; className: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${className}`}
    >
      {isLoading ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block" /> : children}
    </button>
  );
}

// ─── AppInfo ───

function AppInfo({ app }: { app: App }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-white mb-3">About</h2>
      <div className="space-y-2.5 text-xs">
        {app.stars > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Stars</span>
            <span className="text-gray-300">★ {formatStars(app.stars)}</span>
          </div>
        )}
        {app.language && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Language</span>
            <span className="flex items-center gap-1.5 text-gray-300">
              <span className={`w-2 h-2 rounded-full ${langColors[app.language] ?? 'bg-gray-500'}`} />
              {app.language}
            </span>
          </div>
        )}
        {app.license && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">License</span>
            <span className="text-gray-300">{app.license}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Runtime</span>
          <span className="text-gray-300">{runtimeIcons[app.runtime] ?? ''} {app.runtime}</span>
        </div>
        {app.installPath && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Path</span>
            <span className="text-gray-500 font-mono text-[10px] truncate max-w-[180px]" title={app.installPath}>{app.installPath}</span>
          </div>
        )}
        <div className="pt-2 border-t border-white/5">
          <a
            href={`https://github.com/${app.fullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-xs transition-colors flex items-center gap-1"
          >
            View on GitHub →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── VersionInfo ───

function VersionInfo({ app }: { app: App }) {
  const [latestTag, setLatestTag] = useState<string | null>(null);

  useEffect(() => {
    api.getRelease(app.owner, app.repo)
      .then(data => setLatestTag(data.release?.tagName ?? null))
      .catch(() => {});
  }, [app.owner, app.repo]);

  const installedRef = app.installedRef ?? null;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-white mb-3">Version</h2>
      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Installed</span>
          <span className="text-gray-300 font-mono">{installedRef ?? 'latest'}</span>
        </div>
        {latestTag && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Latest</span>
            <span className="text-gray-300 font-mono">{latestTag}</span>
          </div>
        )}
        {latestTag && installedRef && latestTag !== installedRef && (
          <div className="bg-blue-500/10 text-blue-400 text-xs px-3 py-2 rounded-lg mt-2">
            Update available: {latestTag}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LogViewer ───

function LogViewer({ appId }: { appId: string }) {
  const [logs, setLogs] = useState('');
  const [lines, setLines] = useState(50);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.getLogs(appId, lines);
      setLogs(data.logs || '');
    } catch {
      setLogs('');
    }
  }, [appId, lines]);

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefresh]);

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
          Logs
          {autoRefresh && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={lines}
            onChange={e => setLines(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400 px-2 py-1 outline-none"
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={500}>500 lines</option>
          </select>
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`text-xs px-2 py-1 rounded-lg transition-all ${autoRefresh ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-500'}`}
          >
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button onClick={fetchLogs} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 bg-white/5 rounded-lg transition-colors">
            Refresh
          </button>
        </div>
      </div>
      <div className="p-4 max-h-80 overflow-y-auto overflow-x-auto">
        {logs ? (
          <pre className="text-xs text-gray-400 font-mono whitespace-pre leading-relaxed">{logs}</pre>
        ) : (
          <p className="text-gray-600 text-xs text-center py-8">No logs available</p>
        )}
      </div>
    </div>
  );
}

// ─── EnvPanel ───

function EnvPanel({ appId, envVarsRequired, onSave }: { appId: string; envVarsRequired: string[]; onSave: () => void }) {
  const [vars, setVars] = useState<AppEnvVar[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getEnv(appId).then(data => { setVars(data.vars); setLoading(false); }).catch(() => setLoading(false));
  }, [appId]);

  const addVar = async () => {
    if (!newKey.trim()) return;
    await api.setEnv(appId, { [newKey]: newValue });
    const data = await api.getEnv(appId);
    setVars(data.vars);
    setNewKey('');
    setNewValue('');
    onSave();
  };

  const deleteVar = async (key: string) => {
    await api.deleteEnvVar(appId, key);
    setVars(v => v.filter(e => e.key !== key));
    onSave();
  };

  if (loading) return null;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-white mb-3">Environment Variables</h2>

      {envVarsRequired.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Required</p>
          <div className="flex flex-wrap gap-1">
            {envVarsRequired.map(key => {
              const configured = vars.some(v => v.key === key);
              return (
                <span key={key} className={`text-[10px] font-mono px-2 py-0.5 rounded ${configured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {key}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {vars.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {vars.map(v => (
            <div key={v.key} className="flex items-center gap-2 text-xs">
              <span className="text-gray-400 font-mono flex-1 truncate">{v.key}</span>
              <span className="text-gray-600 font-mono truncate max-w-[120px]">{v.isSecret ? '••••••' : v.value}</span>
              <button onClick={() => deleteVar(v.key)} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          placeholder="KEY"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 px-2.5 py-1.5 font-mono outline-none focus:border-blue-500/30 min-w-0"
        />
        <input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder="value"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 px-2.5 py-1.5 font-mono outline-none focus:border-blue-500/30 min-w-0"
        />
        <button onClick={addVar} className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-colors shrink-0">
          Add
        </button>
      </div>
    </div>
  );
}
