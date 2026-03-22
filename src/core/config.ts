import { readFileSync, writeFileSync } from 'node:fs';
import { paths } from '../utils/paths.js';

export interface GitStoreConfig {
  githubToken?: string;
}

export function loadConfig(): GitStoreConfig {
  try {
    return JSON.parse(readFileSync(paths.config, 'utf-8')) as GitStoreConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: GitStoreConfig): void {
  writeFileSync(paths.config, JSON.stringify(config, null, 2) + '\n');
}

export function getGithubToken(): string | undefined {
  // Check config file first, then environment variables
  const config = loadConfig();
  return config.githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
}

export function setGithubToken(token: string): void {
  const config = loadConfig();
  config.githubToken = token;
  saveConfig(config);
}

export function removeGithubToken(): void {
  const config = loadConfig();
  delete config.githubToken;
  saveConfig(config);
}
