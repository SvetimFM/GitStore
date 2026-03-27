import { useState, useEffect, useCallback } from 'react';
import { api, type App } from '../api/client';

export function useAppDetail(id: string) {
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getApp(id);
      setApp(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load app');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { app, loading, error, refresh };
}
