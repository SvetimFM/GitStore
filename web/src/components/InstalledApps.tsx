import { useApps } from '../hooks/useApps';
import { AppControls } from './AppControls';

export function InstalledApps() {
  const { apps, loading, error, refresh } = useApps();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
        {error}
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No apps installed yet</p>
        <p className="text-gray-500 text-sm mt-2">Search the store to find and install apps</p>
      </div>
    );
  }

  const running = apps.filter(a => a.status === 'running');
  const stopped = apps.filter(a => a.status !== 'running');

  return (
    <div className="space-y-6">
      {running.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Running ({running.length})</h2>
          <div className="grid gap-3">
            {running.map(app => (
              <AppControls key={app.id} app={app} onUpdate={refresh} />
            ))}
          </div>
        </div>
      )}
      {stopped.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">
            {running.length > 0 ? 'Other' : 'Installed'} ({stopped.length})
          </h2>
          <div className="grid gap-3">
            {stopped.map(app => (
              <AppControls key={app.id} app={app} onUpdate={refresh} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
