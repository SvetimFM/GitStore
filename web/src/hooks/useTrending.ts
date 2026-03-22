import { useState, useEffect } from 'react';
import { api, type RepoInfo } from '../api/client';

export function useTrending(since: 'daily' | 'weekly' | 'monthly' = 'daily') {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getTrending(since);
        if (!cancelled) {
          setRepos(data.repos);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load trending repos');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [since]);

  return { repos, loading, error };
}
