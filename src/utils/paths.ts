import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

const GITSTORE_HOME = process.env.GITSTORE_HOME ?? join(homedir(), '.gitstore');

export const paths = {
  home: GITSTORE_HOME,
  apps: join(GITSTORE_HOME, 'apps'),
  db: join(GITSTORE_HOME, 'gitstore.db'),
  logs: join(GITSTORE_HOME, 'logs'),
  config: join(GITSTORE_HOME, 'config.json'),

  appDir(owner: string, repo: string): string {
    return join(GITSTORE_HOME, 'apps', owner, repo);
  },

  appLog(owner: string, repo: string): string {
    return join(GITSTORE_HOME, 'logs', `${owner}-${repo}.log`);
  },
};

export function ensureDirs(): void {
  mkdirSync(paths.apps, { recursive: true });
  mkdirSync(paths.logs, { recursive: true });
}
