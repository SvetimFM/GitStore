import { useState, useEffect, useCallback } from 'react';
import { api, type App } from '../api/client';

export function useApps(pollInterval: number = 5000) {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listApps();
      setApps(prev => {
        const next = data.apps;
        // Skip update if nothing changed — avoids re-renders on idle polls
        if (prev.length === next.length &&
            prev.every((a, i) => a.id === next[i].id && a.status === next[i].status && a.pid === next[i].pid)) {
          return prev;
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  return { apps, loading, error, refresh };
}
