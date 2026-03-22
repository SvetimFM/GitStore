import { useState, useEffect } from 'react';
import { api, type Category, type CollectionSummary, type FeaturedAppInfo } from '../api/client';

export function useDiscovery() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [featured, setFeatured] = useState<FeaturedAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(retries = 5) {
      setLoading(true);
      setError(null);

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const [collectionsData, featuredData] = await Promise.all([
            api.getCollections(),
            api.getFeatured(),
          ]);
          if (!cancelled) {
            setCategories(collectionsData.categories);
            setCollections(collectionsData.collections);
            setFeatured(featuredData.featured);
            setLoading(false);
          }
          return;
        } catch (err) {
          // If backend isn't ready yet, wait and retry
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 1000));
          } else if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to load. Is the backend running?');
            setLoading(false);
          }
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { categories, collections, featured, loading, error };
}
