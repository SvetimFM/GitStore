import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

function getHome(): string {
  return process.env.GITSTORE_HOME ?? join(homedir(), '.gitstore');
}

export const paths = {
  get home() { return getHome(); },
  get apps() { return join(getHome(), 'apps'); },
  get db() { return join(getHome(), 'gitstore.db'); },
  get logs() { return join(getHome(), 'logs'); },
  get config() { return join(getHome(), 'config.json'); },

  appDir(owner: string, repo: string): string {
    return join(getHome(), 'apps', owner, repo);
  },

  appLog(owner: string, repo: string): string {
    return join(getHome(), 'logs', `${owner}-${repo}.log`);
  },
};

export function ensureDirs(): void {
  mkdirSync(paths.apps, { recursive: true });
  mkdirSync(paths.logs, { recursive: true });
}
