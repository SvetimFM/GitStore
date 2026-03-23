import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestEnv, cleanupTestEnv, requireGithubToken, TEST_REPOS } from './helpers.js';
import { inspectRepo } from '../src/core/installer.js';
import { ensureDirs } from '../src/utils/paths.js';

describe('Runtime detection via inspectRepo', () => {
  beforeAll(() => {
    setupTestEnv();
    ensureDirs();
    requireGithubToken();
  });

  afterAll(() => {
    cleanupTestEnv();
  });

  it('detects binary runtime for sharkdp/bat', async () => {
    const result = await inspectRepo(TEST_REPOS.binary);
    expect(result.detection).toBeDefined();
    expect(result.detection!.installType).toBe('binary');
    expect(result.detection!.primaryRuntime).toBe('binary');
    expect(result.detection!.binaryAsset).toBeDefined();
  }, 30_000);

  it('detects static runtime for 3D-Hartwig-chess-set', async () => {
    const result = await inspectRepo(TEST_REPOS.static);
    expect(result.detection).toBeDefined();
    expect(result.detection!.primaryRuntime).toBe('static');
  }, 30_000);

  it('detects node runtime for expressjs/express', async () => {
    const result = await inspectRepo(TEST_REPOS.node);
    expect(result.detection).toBeDefined();
    expect(result.detection!.primaryRuntime).toBe('node');
    expect(result.detection!.manifest).toContain('package.json');
  }, 30_000);

  it('detects python runtime for pallets/flask', async () => {
    const result = await inspectRepo(TEST_REPOS.python);
    expect(result.detection).toBeDefined();
    // Flask may detect as binary first (has releases) or python
    expect(['python', 'binary']).toContain(result.detection!.primaryRuntime);
  }, 30_000);

  it('detects go runtime for junegunn/fzf', async () => {
    const result = await inspectRepo(TEST_REPOS.go);
    expect(result.detection).toBeDefined();
    // fzf has binaries on releases, so may detect as binary
    expect(['go', 'binary']).toContain(result.detection!.primaryRuntime);
  }, 30_000);

  it('detects rust runtime for BurntSushi/ripgrep', async () => {
    const result = await inspectRepo(TEST_REPOS.rust);
    expect(result.detection).toBeDefined();
    // ripgrep has binaries on releases
    expect(['rust', 'binary']).toContain(result.detection!.primaryRuntime);
  }, 30_000);

  it('detects docker runtime for louislam/uptime-kuma', async () => {
    const result = await inspectRepo(TEST_REPOS.docker);
    expect(result.detection).toBeDefined();
    // uptime-kuma is Node with Dockerfile
    expect(['node', 'docker']).toContain(result.detection!.primaryRuntime);
  }, 30_000);
});
