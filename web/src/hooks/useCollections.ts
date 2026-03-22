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

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [collectionsData, featuredData] = await Promise.all([
          api.getCollections(),
          api.getFeatured(),
        ]);
        if (!cancelled) {
          setCategories(collectionsData.categories);
          setCollections(collectionsData.collections);
          setFeatured(featuredData.featured);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load discovery data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { categories, collections, featured, loading, error };
}
