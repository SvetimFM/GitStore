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

    CREATE TABLE IF NOT EXISTS app_env (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      is_secret INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(app_id, key)
    );
    CREATE INDEX IF NOT EXISTS idx_app_env_app_id ON app_env(app_id);
  `);

  try { db!.exec(`ALTER TABLE apps ADD COLUMN env_vars_required TEXT`); } catch { /* already exists */ }

  db!.exec(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('repo', 'source')),
      url TEXT NOT NULL,
      category_id TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
  `);
}

function rowToApp(row: Record<string, unknown>): App {
  const envVarsRequired = JSON.parse((row.env_vars_required as string) ?? '[]') as string[];
  const envConfigured = envVarsRequired.length === 0 || envVarsRequired.every(k => getAppEnv(row.id as string).map(v => v.key).includes(k));
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
    envVarsRequired,
    envConfigured,
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
  envVarsRequired?: string[];
}): App {
  const id = randomUUID();
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO apps (
      id, owner, repo, full_name, alias, description, runtime, runtime_version,
      start_command, build_command, install_command, port, stars, language, license,
      default_branch, installed_ref, status, install_path, installed_at, env_vars_required
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, 'installing', ?, ?, ?
    )
  `).run(
    id, data.owner, data.repo, `${data.owner}/${data.repo}`,
    data.alias ?? null, data.description, data.runtime, data.runtimeVersion,
    data.startCommand, data.buildCommand, data.installCommand, data.port,
    data.stars, data.language, data.license,
    data.defaultBranch, data.installedRef, data.installPath, now,
    JSON.stringify(data.envVarsRequired ?? []),
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

export interface AppEnvVar {
  id: string;
  appId: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export function getAppEnv(appId: string): AppEnvVar[] {
  const rows = getDb().prepare('SELECT * FROM app_env WHERE app_id = ? ORDER BY key').all(appId) as Array<Record<string, unknown>>;
  return rows.map(r => ({
    id: r.id as string,
    appId: r.app_id as string,
    key: r.key as string,
    value: r.value as string,
    isSecret: !!(r.is_secret as number),
  }));
}

export function getAppEnvAsRecord(appId: string): Record<string, string> {
  const vars = getAppEnv(appId);
  const record: Record<string, string> = {};
  for (const v of vars) record[v.key] = v.value;
  return record;
}

export function setAppEnvVar(appId: string, key: string, value: string, isSecret: boolean = false): void {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO app_env (id, app_id, key, value, is_secret, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(app_id, key) DO UPDATE SET value = excluded.value, is_secret = excluded.is_secret, updated_at = excluded.updated_at
  `).run(id, appId, key, value, isSecret ? 1 : 0, now, now);
}

export function setAppEnvBulk(appId: string, vars: Record<string, string>, isSecret: boolean = false): void {
  for (const [key, value] of Object.entries(vars)) {
    setAppEnvVar(appId, key, value, isSecret);
  }
}

export function deleteAppEnvVar(appId: string, key: string): void {
  getDb().prepare('DELETE FROM app_env WHERE app_id = ? AND key = ?').run(appId, key);
}

// --- Suggestions ---

export interface Suggestion {
  id: string;
  type: 'repo' | 'source';
  url: string;
  categoryId: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export function createSuggestion(type: 'repo' | 'source', url: string, categoryId?: string, note?: string): Suggestion {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO suggestions (id, type, url, category_id, note, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, type, url, categoryId ?? null, note ?? null, now);

  return { id, type, url, categoryId: categoryId ?? null, note: note ?? null, status: 'pending', createdAt: now };
}

export function listSuggestions(status?: string): Suggestion[] {
  let query = 'SELECT * FROM suggestions';
  const params: unknown[] = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const rows = getDb().prepare(query).all(...params) as Array<Record<string, unknown>>;
  return rows.map(r => ({
    id: r.id as string,
    type: r.type as 'repo' | 'source',
    url: r.url as string,
    categoryId: r.category_id as string | null,
    note: r.note as string | null,
    status: r.status as 'pending' | 'approved' | 'rejected',
    createdAt: r.created_at as string,
  }));
}
