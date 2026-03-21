import { useState } from 'react';
import { api, type App } from '../api/client';

interface AppControlsProps {
  app: App;
  onUpdate: () => void;
}

export function AppControls({ app, onUpdate }: AppControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);

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

  const statusColors: Record<string, string> = {
    running: 'bg-green-500',
    installed: 'bg-gray-500',
    stopped: 'bg-gray-600',
    error: 'bg-red-500',
    installing: 'bg-blue-500',
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${statusColors[app.status] ?? 'bg-gray-500'}`} />
          <div>
            <h3 className="text-white font-semibold">{app.fullName}</h3>
            <p className="text-gray-400 text-xs">
              {app.runtime} {app.port ? `· :${app.port}` : ''} {app.pid ? `· PID ${app.pid}` : ''}
            </p>
          </div>
        </div>
        <span className="text-xs text-gray-500 capitalize">{app.status}</span>
      </div>

      {app.description && (
        <p className="text-gray-400 text-sm mt-2 line-clamp-1">{app.description}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {app.status !== 'running' && (
          <button
            onClick={() => action('start', () => api.start(app.id))}
            disabled={loading !== null}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
          >
            {loading === 'start' ? '...' : 'Start'}
          </button>
        )}
        {app.status === 'running' && (
          <button
            onClick={() => action('stop', () => api.stop(app.id))}
            disabled={loading !== null}
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50"
          >
            {loading === 'stop' ? '...' : 'Stop'}
          </button>
        )}
        {app.status === 'running' && (
          <button
            onClick={() => action('restart', () => api.restart(app.id))}
            disabled={loading !== null}
            className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-500 disabled:opacity-50"
          >
            {loading === 'restart' ? '...' : 'Restart'}
          </button>
        )}
        <button
          onClick={() => action('update', () => api.update(app.id))}
          disabled={loading !== null}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
        >
          {loading === 'update' ? '...' : 'Update'}
        </button>
        <button
          onClick={() => {
            if (confirm(`Uninstall ${app.fullName}?`)) {
              action('uninstall', () => api.uninstall(app.id));
            }
          }}
          disabled={loading !== null}
          className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50"
        >
          {loading === 'uninstall' ? '...' : 'Uninstall'}
        </button>
      </div>
    </div>
  );
}
