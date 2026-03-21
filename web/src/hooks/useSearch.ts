import { useState, useCallback, useRef } from 'react';
import { api, type RepoInfo } from '../api/client';

export function useSearch() {
  const [results, setResults] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((query: string, opts?: { language?: string; minStars?: number }) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.search(query, opts);
        setResults(data.repos);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  return { results, loading, error, search };
}
