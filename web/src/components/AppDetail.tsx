import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type InspectResult } from '../api/client';

export function AppDetail() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<InspectResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!owner || !repo) return;
    setLoading(true);
    api.inspect(owner, repo)
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to inspect'))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  const handleInstall = async () => {
    if (!owner || !repo) return;
    setInstalling(true);
    try {
      await api.install(`${owner}/${repo}`);
      navigate('/my-apps');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
        {error ?? 'Failed to load repo info'}
      </div>
    );
  }

  const { repo: r, detection: d, prerequisites: p, risk: rk } = data;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm">
        &larr; Back
      </button>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{r.fullName}</h1>
            <p className="text-gray-400 mt-1">{r.description ?? 'No description'}</p>
          </div>
          <button
            onClick={handleInstall}
            disabled={installing || !d}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {installing ? 'Installing...' : 'Install'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <Stat label="Stars" value={r.stars.toLocaleString()} />
          <Stat label="Language" value={r.language ?? 'Unknown'} />
          <Stat label="License" value={r.license ?? 'None'} />
          <Stat label="Forks" value={r.forks.toLocaleString()} />
        </div>

        {r.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-4">
            {r.topics.map(t => (
              <span key={t} className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}
      </div>

      {d && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Detection Results</h2>
          <div className="space-y-2 text-sm">
            <Row label="Runtime" value={`${d.primaryRuntime} (${d.confidence} confidence)`} />
            <Row label="Manifest" value={d.manifest} />
            <Row label="Install" value={d.installCommand} mono />
            {d.buildCommand && <Row label="Build" value={d.buildCommand} mono />}
            <Row label="Start" value={d.startCommand} mono />
            {d.detectedPort && <Row label="Port" value={String(d.detectedPort)} />}
            {d.runtimeVersion && <Row label="Runtime version" value={d.runtimeVersion} />}
            {d.envVarsRequired.length > 0 && (
              <Row label="Required env vars" value={d.envVarsRequired.join(', ')} />
            )}
          </div>
        </div>
      )}

      {rk && (
        <div className={`border rounded-lg p-6 ${
          rk.level === 'low' ? 'bg-green-900/20 border-green-800' :
          rk.level === 'medium' ? 'bg-yellow-900/20 border-yellow-800' :
          'bg-red-900/20 border-red-800'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-3 h-3 rounded-full ${
              rk.level === 'low' ? 'bg-green-500' :
              rk.level === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <h2 className={`text-lg font-semibold ${
              rk.level === 'low' ? 'text-green-400' :
              rk.level === 'medium' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {rk.level.toUpperCase()} RISK (score: {rk.score}/100)
            </h2>
          </div>
          {rk.reasons.length > 0 && (
            <ul className="space-y-1 text-sm text-gray-300">
              {rk.reasons.map((reason, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gray-500">-</span>
                  {reason}
                </li>
              ))}
            </ul>
          )}
          {rk.hasDockerfile && rk.level !== 'low' && (
            <p className="mt-3 text-sm text-blue-400">
              This repo has a Dockerfile — consider using Docker runtime for isolation.
            </p>
          )}
        </div>
      )}

      {!d && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 text-yellow-400">
          Could not detect project type. No recognized build manifest found in this repo.
        </div>
      )}

      {p && (
        <div className={`border rounded-lg p-4 ${p.met ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
          {p.met
            ? 'All prerequisites met — ready to install'
            : `Missing prerequisites: ${p.missing.join(', ')}`}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-500 w-36 shrink-0">{label}</span>
      <span className={`text-gray-300 ${mono ? 'font-mono text-xs bg-gray-900 px-2 py-0.5 rounded' : ''}`}>{value}</span>
    </div>
  );
}
