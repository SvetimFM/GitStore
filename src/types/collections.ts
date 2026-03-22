import type { RepoInfo } from './github.js';

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  color?: string;
}

export interface CollectionRepo {
  fullName: string;
  note?: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  repos: CollectionRepo[];
}

export interface FeaturedApp {
  fullName: string;
  tagline?: string;
}

export interface EnrichedRepo extends CollectionRepo {
  info: RepoInfo | null;
}

export interface EnrichedCollection extends Omit<Collection, 'repos'> {
  repos: EnrichedRepo[];
}

export interface EnrichedFeatured extends FeaturedApp {
  info: RepoInfo | null;
}
