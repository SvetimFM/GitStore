import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getBaseUrl, type InspectResult } from '../api/client';
import { githubAvatarUrl } from '../utils/format';
import { ReadmePreview } from './ReadmePreview';
import { ReleaseInfo } from './ReleaseInfo';

type WizardStep = 'confirm' | 'installing' | 'done' | 'error';

function InstallWizard({
  data,
  owner,
  repo,
  onClose,
  onSuccess,
}: {
  data: InspectResult;
  owner: string;
  repo: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<WizardStep>('confirm');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [statusText, setStatusText] = useState('Starting...');
  const [logOutput, setLogOutput] = useState('');

  const { detection: d, risk: rk } = data;

  const handleConfirmInstall = () => {
    setStep('installing');
    setStatusText('Starting...');
    setLogOutput('');

    const base = getBaseUrl();
    const url = `${base}/api/install-stream?repo=${encodeURIComponent(`${owner}/${repo}`)}`;
    const es = new EventSource(url);

    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      setStatusText(data.message);
    });

    es.addEventListener('output', (e) => {
      const data = JSON.parse(e.data);
      setLogOutput(prev => prev + data.text);
    });

    es.addEventListener('complete', () => {
      es.close();
      setStep('done');
    });

    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setErrorMessage(data.message);
      } catch {
        setErrorMessage('Installation failed');
      }
      es.close();
      setStep('error');
    });
  };

  const handleOverlayClick = () => {
    if (step === 'confirm' || step === 'done' || step === 'error') {
      onClose();
    }
  };

  const riskStyles = rk ? {
    low:    { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Low Risk' },
    medium: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Medium Risk' },
    high:   { dot: 'bg-red-400', text: 'text-red-400', label: 'High Risk' },
  }[rk.level] : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-[#12121a] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {step === 'confirm' && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <img
                src={githubAvatarUrl(owner)}
                alt={owner}
                className="w-14 h-14 rounded-xl shadow-lg"
              />
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white truncate">{repo}</h3>
                <p className="text-gray-500 text-sm">{owner}</p>
              </div>
            </div>

            <div className="space-y-2.5 text-sm">
              {d && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Runtime</span>
                    <span className="text-white font-medium">{d.primaryRuntime}</span>
                  </div>
                  {d.detectedPort && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Port</span>
                      <span className="text-white font-medium">{d.detectedPort}</span>
                    </div>
                  )}
                </>
              )}
              {rk && riskStyles && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Risk Level</span>
                  <span className={`flex items-center gap-1.5 font-medium ${riskStyles.text}`}>
                    <span className={`w-2 h-2 rounded-full ${riskStyles.dot}`} />
                    {riskStyles.label}
                  </span>
                </div>
              )}
            </div>

            {d && d.envVarsRequired.length > 0 && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-300">
                Environment variables ({d.envVarsRequired.join(', ')}) will be configured after install.
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-400 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmInstall}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 rounded-full hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
              >
                Confirm Install
              </button>
            </div>
          </div>
        )}

        {step === 'installing' && (
          <div className="flex flex-col items-center py-8 space-y-5">
            <div className="w-12 h-12 border-3 border-white/10 border-t-blue-500 rounded-full animate-spin" />
            <div className="text-center space-y-1.5">
              <p className="text-white font-medium">Installing {repo}</p>
              <p className="text-gray-500 text-sm">{statusText}</p>
            </div>
            {logOutput && (
              <div style={{
                maxHeight: '200px', overflow: 'auto',
                background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                padding: '10px', marginTop: '16px', width: '100%',
                fontFamily: 'ui-monospace, monospace', fontSize: '11px',
                color: '#8b8ba0', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {logOutput.slice(-3000)}
              </div>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center py-8 space-y-5">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="m9 11 3 3L22 4" />
              </svg>
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-white font-semibold text-lg">Installed Successfully</p>
              <p className="text-gray-500 text-sm">{owner}/{repo} is ready to use.</p>
            </div>
            <button
              onClick={onSuccess}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-500 rounded-full hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
            >
              Go to My Apps
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center py-8 space-y-5">
            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6" />
                <path d="m9 9 6 6" />
              </svg>
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-white font-semibold text-lg">Install Failed</p>
              <p className="text-red-400 text-sm">{errorMessage}</p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-gray-400 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AppDetail() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<InspectResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (!owner || !repo) return;
    setLoading(true);
    api.inspect(owner, repo)
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to inspect'))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-5 w-16 rounded animate-shimmer" />
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl animate-shimmer" />
          <div className="space-y-3 flex-1">
            <div className="h-8 w-48 rounded-lg animate-shimmer" />
            <div className="h-4 w-96 rounded animate-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
          {error ?? 'Failed to load repo info'}
        </div>
      </div>
    );
  }

  const { repo: r, detection: d, prerequisites: p, risk: rk } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {showWizard && owner && repo && (
        <InstallWizard
          data={data}
          owner={owner}
          repo={repo}
          onClose={() => setShowWizard(false)}
          onSuccess={() => navigate('/my-apps')}
        />
      )}

      <button
        onClick={() => navigate(-1)}
        className="text-gray-500 text-sm hover:text-white transition-colors flex items-center gap-1.5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-start gap-5">
          <img
            src={githubAvatarUrl(r.owner)}
            alt={r.owner}
            className="w-20 h-20 rounded-2xl shadow-xl"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-white">{r.name}</h1>
            <p className="text-gray-500 text-sm">{r.owner}</p>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">{r.description ?? 'No description'}</p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            disabled={!d}
            className="px-6 py-2.5 bg-blue-500 text-white text-sm font-semibold rounded-full hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors shadow-lg shadow-blue-500/20"
          >
            GET
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
          <Stat icon={<StarIcon />} label="Stars" value={r.stars.toLocaleString()} />
          <Stat icon={<CodeIcon />} label="Language" value={r.language ?? 'Unknown'} />
          <Stat icon={<ScaleIcon />} label="License" value={r.license ?? 'None'} />
          <Stat icon={<ForkIcon />} label="Forks" value={r.forks.toLocaleString()} />
        </div>

        {r.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {r.topics.map(t => (
              <span key={t} className="text-xs bg-white/5 text-gray-400 px-2.5 py-1 rounded-full">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Detection */}
      {d && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            Detection Results
          </h2>
          <div className="space-y-3 text-sm">
            <Row label="Runtime" value={d.primaryRuntime} badge={d.confidence} />
            <Row label="Manifest" value={d.manifest} />
            <Row label="Install" value={d.installCommand} mono />
            {d.buildCommand && <Row label="Build" value={d.buildCommand} mono />}
            <Row label="Start" value={d.startCommand} mono />
            {d.detectedPort && <Row label="Port" value={String(d.detectedPort)} />}
            {d.runtimeVersion && <Row label="Version" value={d.runtimeVersion} />}
            {d.envVarsRequired.length > 0 && (
              <Row label="Env vars" value={d.envVarsRequired.join(', ')} />
            )}
          </div>
        </div>
      )}

      {/* Env vars notice */}
      {d && d.envVarsRequired.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          <div>
            <p className="text-purple-300 font-medium text-sm">Environment variables required</p>
            <p className="text-gray-400 text-xs mt-1">You'll configure <span className="text-purple-400">{d.envVarsRequired.join(', ')}</span> after installation.</p>
          </div>
        </div>
      )}

      {/* Risk */}
      {rk && (() => {
        const riskStyles = {
          low:    { card: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Low' },
          medium: { card: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', text: 'text-amber-400', label: 'Medium' },
          high:   { card: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-400', text: 'text-red-400', label: 'High' },
        };
        const rs = riskStyles[rk.level];
        return (
        <div className={`border rounded-2xl p-6 ${rs.card}`}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className={`w-2.5 h-2.5 rounded-full ${rs.dot}`} />
            <h2 className={`text-sm font-semibold ${rs.text}`}>
              {rs.label} Risk
              <span className="text-gray-500 font-normal ml-2">Score: {rk.score}/100</span>
            </h2>
          </div>
          {rk.reasons.length > 0 && (
            <ul className="space-y-1.5 text-sm text-gray-400">
              {rk.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-gray-600 mt-0.5">-</span>
                  {reason}
                </li>
              ))}
            </ul>
          )}
          {rk.hasDockerfile && rk.level !== 'low' && (
            <p className="mt-3 text-sm text-blue-400 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
              This repo has a Dockerfile — consider using Docker for isolation.
            </p>
          )}
        </div>
        );
      })()}

      {/* No detection */}
      {!d && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-400 text-sm flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
          Could not detect project type. No recognized build manifest found.
        </div>
      )}

      {/* Prerequisites */}
      {p && (
        <div className={`border rounded-xl p-4 text-sm flex items-center gap-3 ${
          p.met
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : p.fallbackDetection
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {p.met ? (
              <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></>
            ) : (
              <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></>
            )}
          </svg>
          {p.met
            ? 'All prerequisites met — ready to install'
            : p.fallbackDetection
              ? `Missing: ${p.missing.join(', ')} — Docker fallback available`
              : `Missing prerequisites: ${p.missing.join(', ')}`}
        </div>
      )}

      {/* README */}
      <ReadmePreview owner={owner!} repo={repo!} />

      {/* Release */}
      <ReleaseInfo owner={owner!} repo={repo!} />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-gray-600">{icon}</span>
      <div>
        <p className="text-gray-600 text-[10px] uppercase tracking-wider">{label}</p>
        <p className="text-white text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value, mono, badge }: { label: string; value: string; mono?: boolean; badge?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-600 w-24 shrink-0 text-xs uppercase tracking-wider">{label}</span>
      <span className={`text-gray-300 ${mono ? 'font-mono text-xs bg-white/5 px-2.5 py-1 rounded-lg' : 'text-sm'}`}>
        {value}
      </span>
      {badge && (
        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">{badge}</span>
      )}
    </div>
  );
}

function StarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
}
function CodeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
}
function ScaleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>;
}
function ForkIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/></svg>;
}
