import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { paths, ensureDirs } from '../utils/paths.js';
import type { App, AppStatus } from '../types/app.js';

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    ensureDirs();
    db = new Database(paths.db);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      full_name TEXT NOT NULL UNIQUE,
      alias TEXT UNIQUE,
      description TEXT,
      runtime TEXT NOT NULL,
      runtime_version TEXT,
      start_command TEXT NOT NULL,
      build_command TEXT,
      install_command TEXT NOT NULL,
      port INTEGER,
      stars INTEGER DEFAULT 0,
      language TEXT,
      license TEXT,
      default_branch TEXT,
      installed_ref TEXT,
      status TEXT NOT NULL DEFAULT 'installing',
      pid INTEGER,
      install_path TEXT NOT NULL,
      installed_at TEXT NOT NULL,
      updated_at TEXT,
      last_started_at TEXT,
      last_stopped_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
    CREATE INDEX IF NOT EXISTS idx_apps_alias ON apps(alias);
    CREATE INDEX IF NOT EXISTS idx_apps_full_name ON apps(full_name);
  `);
}

function rowToApp(row: Record<string, unknown>): App {
  return {
    id: row.id as string,
    owner: row.owner as string,
    repo: row.repo as string,
    fullName: row.full_name as string,
    alias: row.alias as string | null,
    description: row.description as string | null,
    runtime: row.runtime as App['runtime'],
    runtimeVersion: row.runtime_version as string | null,
    startCommand: row.start_command as string,
    buildCommand: row.build_command as string | null,
    installCommand: row.install_command as string,
    port: row.port as number | null,
    stars: row.stars as number,
    language: row.language as string | null,
    license: row.license as string | null,
    defaultBranch: row.default_branch as string,
    installedRef: row.installed_ref as string,
    status: row.status as AppStatus,
    pid: row.pid as number | null,
    installPath: row.install_path as string,
    installedAt: row.installed_at as string,
    updatedAt: row.updated_at as string | null,
    lastStartedAt: row.last_started_at as string | null,
    lastStoppedAt: row.last_stopped_at as string | null,
  };
}

export function createApp(data: {
  owner: string;
  repo: string;
  alias?: string;
  description: string | null;
  runtime: string;
  runtimeVersion: string | null;
  startCommand: string;
  buildCommand: string | null;
  installCommand: string;
  port: number | null;
  stars: number;
  language: string | null;
  license: string | null;
  defaultBranch: string;
  installedRef: string;
  installPath: string;
}): App {
  const id = randomUUID();
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO apps (
      id, owner, repo, full_name, alias, description, runtime, runtime_version,
      start_command, build_command, install_command, port, stars, language, license,
      default_branch, installed_ref, status, install_path, installed_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, 'installing', ?, ?
    )
  `).run(
    id, data.owner, data.repo, `${data.owner}/${data.repo}`,
    data.alias ?? null, data.description, data.runtime, data.runtimeVersion,
    data.startCommand, data.buildCommand, data.installCommand, data.port,
    data.stars, data.language, data.license,
    data.defaultBranch, data.installedRef, data.installPath, now,
  );

  return getApp(id)!;
}

export function getApp(id: string): App | null {
  const row = getDb().prepare('SELECT * FROM apps WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToApp(row) : null;
}

export function getAppByName(fullName: string): App | null {
  const row = getDb().prepare('SELECT * FROM apps WHERE full_name = ? OR alias = ?').get(fullName, fullName) as Record<string, unknown> | undefined;
  return row ? rowToApp(row) : null;
}

export function findApp(idOrAlias: string): App | null {
  // Try by ID first, then by full_name, then by alias
  return getApp(idOrAlias) ?? getAppByName(idOrAlias);
}

export function listApps(status?: AppStatus): App[] {
  let query = 'SELECT * FROM apps';
  const params: unknown[] = [];

  if (status && status !== ('all' as string)) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY installed_at DESC';

  const rows = getDb().prepare(query).all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToApp);
}

export function updateAppStatus(id: string, status: AppStatus, pid?: number | null): void {
  const updates: string[] = ['status = ?'];
  const params: unknown[] = [status];

  if (pid !== undefined) {
    updates.push('pid = ?');
    params.push(pid);
  }

  if (status === 'running') {
    updates.push('last_started_at = ?');
    params.push(new Date().toISOString());
  } else if (status === 'stopped') {
    updates.push('last_stopped_at = ?');
    params.push(new Date().toISOString());
    updates.push('pid = NULL');
  }

  params.push(id);
  getDb().prepare(`UPDATE apps SET ${updates.join(', ')} WHERE id = ?`).run(...params);
}

export function deleteApp(id: string): void {
  getDb().prepare('DELETE FROM apps WHERE id = ?').run(id);
}

export function updateAppUpdatedAt(id: string): void {
  getDb().prepare('UPDATE apps SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
}
