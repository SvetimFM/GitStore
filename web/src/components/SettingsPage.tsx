import { useState, useEffect } from 'react';
import { api } from '../api/client';

export function SettingsPage() {
  // GitHub token state
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Rate limit state
  const [rateLimit, setRateLimit] = useState<{ remaining: number; limit: number; reset: number } | null>(null);
  const [rateLimitLoading, setRateLimitLoading] = useState(true);

  // MCP copy state
  const [copied, setCopied] = useState<string | null>(null);

  // MCP auto-config state
  const [mcpConfigured, setMcpConfigured] = useState(false);
  const [mcpLoading, setMcpLoading] = useState(true);
  const [mcpMessage, setMcpMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mcpConfigPath, setMcpConfigPath] = useState<string | null>(null);

  useEffect(() => {
    loadTokenStatus();
    loadRateLimit();
    loadMcpStatus();
  }, []);

  const loadTokenStatus = async () => {
    try {
      const data = await api.getTokenStatus();
      setHasToken(data.hasToken);
    } catch {
      // ignore
    } finally {
      setTokenLoading(false);
    }
  };

  const loadRateLimit = async () => {
    try {
      const data = await api.getRateLimit();
      setRateLimit(data);
    } catch {
      // ignore
    } finally {
      setRateLimitLoading(false);
    }
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    setTokenSaving(true);
    setTokenMessage(null);
    try {
      await api.setToken(tokenInput.trim());
      setHasToken(true);
      setTokenInput('');
      setTokenMessage({ type: 'success', text: 'Token saved and verified successfully.' });
      loadRateLimit();
    } catch (err) {
      setTokenMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save token' });
    } finally {
      setTokenSaving(false);
    }
  };

  const handleRemoveToken = async () => {
    setTokenSaving(true);
    setTokenMessage(null);
    try {
      await api.removeToken();
      setHasToken(false);
      setTokenMessage({ type: 'success', text: 'Token removed.' });
      loadRateLimit();
    } catch (err) {
      setTokenMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to remove token' });
    } finally {
      setTokenSaving(false);
    }
  };

  const loadMcpStatus = async () => {
    try {
      const data = await api.getMcpStatus();
      setMcpConfigured(data.configured);
      setMcpConfigPath(data.configPath);
    } catch {
      // ignore
    } finally {
      setMcpLoading(false);
    }
  };

  const handleSetupMcp = async () => {
    setMcpLoading(true);
    setMcpMessage(null);
    try {
      const data = await api.setupMcp();
      setMcpConfigured(true);
      setMcpConfigPath(data.configPath);
      setMcpMessage({ type: 'success', text: 'GitStore MCP configured successfully. Restart Claude to apply.' });
    } catch (err) {
      setMcpMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to configure MCP' });
    } finally {
      setMcpLoading(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback
    }
  };

  const rateLimitPercentage = rateLimit ? ((rateLimit.remaining / rateLimit.limit) * 100) : 0;
  const resetTime = rateLimit ? new Date(rateLimit.reset * 1000).toLocaleTimeString() : '';

  const mcpCommand = 'gitstore-mcp';
  const mcpConfigJson = JSON.stringify({
    mcpServers: {
      gitstore: {
        command: 'node',
        args: ['/path/to/dist/mcp/index.js'],
      },
    },
  }, null, 2);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* GitHub Token */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
          GitHub Token
        </h2>

        <div className="space-y-4">
          {/* Status indicator */}
          {!tokenLoading && (
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${hasToken ? 'bg-emerald-400' : 'bg-gray-600'}`} />
              <span className={hasToken ? 'text-emerald-400' : 'text-gray-500'}>
                {hasToken ? 'Token configured' : 'No token configured'}
              </span>
            </div>
          )}

          <p className="text-gray-500 text-xs leading-relaxed">
            A GitHub personal access token increases the API rate limit from 60 to 5,000 requests/hour.
            No special scopes are required for public repositories.
          </p>

          {/* Token input */}
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveToken()}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 font-mono"
            />
            <button
              onClick={handleSaveToken}
              disabled={tokenSaving || !tokenInput.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {tokenSaving ? 'Saving...' : 'Save'}
            </button>
            {hasToken && (
              <button
                onClick={handleRemoveToken}
                disabled={tokenSaving}
                className="px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Remove
              </button>
            )}
          </div>

          {/* Feedback message */}
          {tokenMessage && (
            <div className={`text-sm px-3 py-2 rounded-lg ${
              tokenMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {tokenMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Rate Limit */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          API Rate Limit
        </h2>

        {rateLimitLoading ? (
          <div className="space-y-3">
            <div className="h-4 w-48 rounded animate-shimmer" />
            <div className="h-2 w-full rounded animate-shimmer" />
          </div>
        ) : rateLimit ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                <span className="text-white font-semibold">{rateLimit.remaining.toLocaleString()}</span>
                {' / '}
                <span className="text-gray-500">{rateLimit.limit.toLocaleString()}</span>
                {' requests remaining'}
              </span>
              <span className="text-gray-600 text-xs">Resets at {resetTime}</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  rateLimitPercentage > 50
                    ? 'bg-emerald-500'
                    : rateLimitPercentage > 20
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${rateLimitPercentage}%` }}
              />
            </div>

            <button
              onClick={() => { setRateLimitLoading(true); loadRateLimit(); }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
              Refresh
            </button>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Unable to fetch rate limit information.</p>
        )}
      </div>

      {/* MCP Server */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
          MCP Server
        </h2>

        <div className="space-y-5">
          {/* One-click Configure for Claude */}
          <div>
            <p className="text-gray-500 text-xs mb-3">
              Automatically add GitStore as an MCP server in Claude Desktop or Claude Code.
            </p>

            {mcpLoading ? (
              <div className="h-10 w-52 rounded-lg animate-shimmer" />
            ) : mcpConfigured ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Configured for Claude
                  </span>
                  <button
                    onClick={handleSetupMcp}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
                  >
                    Reconfigure
                  </button>
                </div>
                {mcpConfigPath && (
                  <p className="text-gray-600 text-xs font-mono">{mcpConfigPath}</p>
                )}
              </div>
            ) : (
              <button
                onClick={handleSetupMcp}
                disabled={mcpLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/20"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
                </svg>
                Configure for Claude
              </button>
            )}

            {/* Feedback message */}
            {mcpMessage && (
              <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${
                mcpMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}>
                {mcpMessage.text}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Manual config fallback */}
          <div>
            <p className="text-gray-500 text-xs mb-2">Run the MCP server manually with:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono">
                {mcpCommand}
              </code>
              <button
                onClick={() => handleCopy(mcpCommand, 'cmd')}
                className="px-3 py-2 text-xs font-medium text-gray-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              >
                {copied === 'cmd' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-1.5">
              Or: <code className="text-gray-500">node dist/mcp/index.js</code>
            </p>
          </div>

          <div>
            <p className="text-gray-500 text-xs mb-2">Claude Desktop configuration (manual):</p>
            <div className="relative">
              <pre className="bg-white/5 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto leading-relaxed">
                {mcpConfigJson}
              </pre>
              <button
                onClick={() => handleCopy(mcpConfigJson, 'config')}
                className="absolute top-2 right-2 px-2.5 py-1 text-xs font-medium text-gray-400 bg-white/10 rounded-md hover:bg-white/15 transition-colors"
              >
                {copied === 'config' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
