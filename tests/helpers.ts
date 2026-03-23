import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const TEST_REPOS = {
  binary: 'sharkdp/bat',
  static: 'juliangarnier/3D-Hartwig-chess-set',
  node: 'expressjs/express',
  python: 'pallets/flask',
  go: 'junegunn/fzf',
  rust: 'BurntSushi/ripgrep',
  docker: 'louislam/uptime-kuma',
} as const;

let testHome: string | null = null;

/** Set up an isolated GITSTORE_HOME in a temp directory. Call in beforeAll. */
export function setupTestEnv(): string {
  testHome = mkdtempSync(join(tmpdir(), 'gitstore-test-'));
  process.env.GITSTORE_HOME = testHome;
  return testHome;
}

/** Clean up the test environment. Call in afterAll. */
export function cleanupTestEnv(): void {
  if (testHome) {
    rmSync(testHome, { recursive: true, force: true });
    delete process.env.GITSTORE_HOME;
    testHome = null;
  }
}

/** Skip test suite if GITHUB_TOKEN is not set (avoids rate limits). */
export function requireGithubToken(): void {
  if (!process.env.GITHUB_TOKEN) {
    console.warn('⚠ GITHUB_TOKEN not set — tests will use unauthenticated API (60 req/hr limit)');
  }
}
