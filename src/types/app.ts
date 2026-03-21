export type ProjectType = 'node' | 'python' | 'docker' | 'rust' | 'go' | 'static' | 'unknown';

export type AppStatus = 'installing' | 'installed' | 'running' | 'stopped' | 'error';

export interface App {
  id: string;
  owner: string;
  repo: string;
  fullName: string;
  alias: string | null;
  description: string | null;
  runtime: ProjectType;
  runtimeVersion: string | null;
  startCommand: string;
  buildCommand: string | null;
  installCommand: string;
  port: number | null;
  status: AppStatus;
  pid: number | null;
  installPath: string;
  stars: number;
  language: string | null;
  license: string | null;
  defaultBranch: string;
  installedRef: string;
  installedAt: string;
  updatedAt: string | null;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
}
