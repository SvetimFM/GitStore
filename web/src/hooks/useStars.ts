import { useState, useEffect, useCallback } from 'react';
import { api, type RepoInfo } from '../api/client';

interface AuthUser {
  login: string;
  avatarUrl: string;
  name: string | null;
}

export function useStars() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const userData = await api.getUser();
        if (cancelled) return;

        setAuthenticated(userData.authenticated);
        setUser(userData.user ?? null);

        if (userData.authenticated) {
          const starsData = await api.getStars(1);
          if (cancelled) return;
          setRepos(starsData.repos);
          setHasMore(starsData.hasMore);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load starred repos');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await api.getStars(nextPage);
      setRepos(prev => [...prev, ...data.repos]);
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more starred repos');
    } finally {
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore]);

  return { repos, loading, error, hasMore, loadMore, loadingMore, authenticated, user };
}
