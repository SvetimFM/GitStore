export interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  license: string | null;
  topics: string[];
  defaultBranch: string;
  updatedAt: string;
  createdAt: string;
  homepage: string | null;
  isArchived: boolean;
  openIssues: number;
}

export interface SearchResult {
  repos: RepoInfo[];
  totalCount: number;
}

export interface RepoFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
}
