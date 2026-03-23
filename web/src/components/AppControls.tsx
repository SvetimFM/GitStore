import { useState } from 'react';
import { api, type App } from '../api/client';
import { githubAvatarUrl } from '../utils/format';
import { EnvConfigPanel } from './EnvConfigPanel';

interface AppControlsProps {
  app: App;
  onUpdate: () => void;
  compact?: boolean;
}

const statusConfig: Record<string, { color: string; glow?: boolean; label: string }> = {
  running:    { color: 'bg-emerald-400', glow: true, label: 'Running' },
  installed:  { color: 'bg-gray-500',    label: 'Installed' },
  stopped:    { color: 'bg-gray-600',    label: 'Stopped' },
  error:      { color: 'bg-red-400',     label: 'Error' },
  installing: { color: 'bg-blue-400',    label: 'Installing' },
};

export function AppControls({ app, onUpdate, compact }: AppControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showEnvConfig, setShowEnvConfig] = useState(false);

  const action = async (name: string, fn: () => Promise<unknown>) => {
    setLoading(name);
    try {
      await fn();
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(null);
    }
  };

  const status = statusConfig[app.status] ?? statusConfig.installed;
  const [owner] = app.fullName.split('/');

  const buttons = (
    <div className="flex items-center gap-1.5 shrink-0">
      {app.status !== 'running' && (
        <ActionBtn
          onClick={() => action('start', () => api.start(app.id))}
          disabled={loading !== null}
          loading={loading === 'start'}
          variant="green"
          icon={<PlayIcon />}
          label="Start"
        />
      )}
      {app.status === 'running' && (
        <ActionBtn
          onClick={() => action('stop', () => api.stop(app.id))}
          disabled={loading !== null}
          loading={loading === 'stop'}
          variant="red"
          icon={<StopIcon />}
          label="Stop"
        />
      )}
      {app.status === 'running' && (
        <ActionBtn
          onClick={() => action('restart', () => api.restart(app.id))}
          disabled={loading !== null}
          loading={loading === 'restart'}
          variant="amber"
          icon={<RestartIcon />}
          label="Restart"
        />
      )}
      {!compact && (
        <>
          <ActionBtn
            onClick={() => action('update', () => api.update(app.id))}
            disabled={loading !== null}
            loading={loading === 'update'}
            variant="blue"
            icon={<UpdateIcon />}
            label="Update"
          />
          <ActionBtn
            onClick={() => setShowEnvConfig(v => !v)}
            variant={showEnvConfig ? 'purple-active' : 'purple'}
            icon={<SettingsIcon />}
            label="Configure"
          />
          <ActionBtn
            onClick={() => {
              if (confirm(`Uninstall ${app.fullName}?`)) {
                action('uninstall', () => api.uninstall(app.id));
              }
            }}
            disabled={loading !== null}
            loading={loading === 'uninstall'}
            variant="ghost"
            icon={<TrashIcon />}
            label="Uninstall"
          />
        </>
      )}
    </div>
  );

  if (compact) return buttons;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.08] transition-all">
      <div className="flex items-center gap-4">
        <img
          src={githubAvatarUrl(owner)}
          alt={owner}
          className="w-12 h-12 rounded-xl"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold text-sm truncate">{app.fullName}</h3>
            <span className={`w-2 h-2 rounded-full ${status.color} shrink-0 ${status.glow ? 'animate-pulse-glow' : ''}`} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-gray-500 text-xs">{app.runtime}</span>
            {app.port && (
              <>
                <span className="text-gray-700 text-xs">·</span>
                <span className="text-gray-500 text-xs">:{app.port}</span>
              </>
            )}
            {app.status === 'running' && app.port && (
              <>
                <span className="text-gray-700 text-xs">·</span>
                <a
                  href={`http://localhost:${app.port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 text-xs hover:text-blue-300 transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  Open
                </a>
              </>
            )}
          </div>
        </div>
        {buttons}
      </div>

      {showEnvConfig && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <EnvConfigPanel app={app} onSave={() => { setShowEnvConfig(false); onUpdate(); }} />
        </div>
      )}
    </div>
  );
}

type Variant = 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'purple-active' | 'ghost';

const variantStyles: Record<Variant, string> = {
  green:          'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
  red:            'bg-red-500/10 text-red-400 hover:bg-red-500/20',
  amber:          'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
  blue:           'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20',
  purple:         'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20',
  'purple-active': 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30',
  ghost:          'bg-white/5 text-gray-500 hover:bg-red-500/10 hover:text-red-400',
};

function ActionBtn({ onClick, disabled, loading: isLoading, variant, icon, label }: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant: Variant;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 ${variantStyles[variant]}`}
    >
      {isLoading ? (
        <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      ) : icon}
    </button>
  );
}

function PlayIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
function StopIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect width="14" height="14" x="5" y="5" rx="2"/></svg>;
}
function RestartIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>;
}
function UpdateIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;
}
function SettingsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
}
