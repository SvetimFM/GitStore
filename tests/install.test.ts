import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { setupTestEnv, cleanupTestEnv, requireGithubToken, TEST_REPOS } from './helpers.js';
import { installApp, uninstallApp } from '../src/core/installer.js';
import { startApp, stopApp } from '../src/core/lifecycle.js';
import { findApp } from '../src/core/registry.js';
import { ensureDirs } from '../src/utils/paths.js';

describe('Binary install lifecycle (sharkdp/bat)', () => {
  beforeAll(() => {
    setupTestEnv();
    ensureDirs();
    requireGithubToken();
  });

  afterAll(() => {
    cleanupTestEnv();
  });

  let appId: string;

  it('installs the binary', async () => {
    const result = await installApp(TEST_REPOS.binary);
    expect(result.app).toBeDefined();
    expect(result.app.installType).toBe('binary');
    expect(result.app.status).toBe('installed');
    expect(result.app.installedRef).toBeTruthy();
    appId = result.app.id;
  }, 120_000);

  it('app record exists in registry', () => {
    const app = findApp(appId);
    expect(app).toBeDefined();
    expect(app!.fullName).toBe('sharkdp/bat');
  });

  it('uninstalls cleanly', async () => {
    await uninstallApp(appId);
    const app = findApp(appId);
    expect(app).toBeNull();
  });
});

describe('Static install lifecycle (3D-Hartwig-chess-set)', () => {
  beforeAll(() => {
    setupTestEnv();
    ensureDirs();
    requireGithubToken();
  });

  afterAll(async () => {
    // Clean up any running apps
    try {
      const app = findApp('juliangarnier/3D-Hartwig-chess-set');
      if (app) {
        if (app.status === 'running') await stopApp(app.id);
        await uninstallApp(app.id);
      }
    } catch { /* ignore */ }
    cleanupTestEnv();
  });

  let appId: string;

  it('installs from source', async () => {
    const result = await installApp(TEST_REPOS.static);
    expect(result.app).toBeDefined();
    expect(result.app.runtime).toBe('static');
    expect(result.app.status).toBe('installed');
    expect(existsSync(result.app.installPath)).toBe(true);
    appId = result.app.id;
  }, 120_000);

  it('starts the app', async () => {
    const app = await startApp(appId);
    expect(app.status).toBe('running');
    expect(app.pid).toBeGreaterThan(0);
  });

  it('stops the app', async () => {
    const app = await stopApp(appId);
    expect(app.status).toBe('stopped');
  });

  it('uninstalls and removes files', async () => {
    const app = findApp(appId)!;
    const installPath = app.installPath;
    await uninstallApp(appId);
    expect(findApp(appId)).toBeNull();
    expect(existsSync(installPath)).toBe(false);
  });
});
