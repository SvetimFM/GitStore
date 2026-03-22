import { useApps } from '../hooks/useApps';
import { AppControls } from './AppControls';

export function InstalledApps() {
  const { apps, loading, error, refresh } = useApps();

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
      {running.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: '1.35rem' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" />
            Running
            <span className="text-gray-600 font-normal text-sm ml-1">({running.length})</span>
          </h2>
          <div className="grid gap-3">
            {running.map(app => (
              <AppControls key={app.id} app={app} onUpdate={refresh} />
            ))}
          </div>
        </div>
      )}
      {other.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: '1.35rem' }}>
            {running.length > 0 ? 'Stopped' : 'Installed'}
            <span className="text-gray-600 font-normal text-sm ml-2">({other.length})</span>
          </h2>
          <div className="grid gap-3">
            {other.map(app => (
              <AppControls key={app.id} app={app} onUpdate={refresh} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
