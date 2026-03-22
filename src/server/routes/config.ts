import { Router } from 'express';
import { homedir } from 'node:os';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGithubToken, setGithubToken, removeGithubToken } from '../../core/config.js';
import { getRateLimit } from '../../core/github.js';

export const configRouter = Router();

// GET /github-token — check if a token is configured
configRouter.get('/github-token', (_req, res) => {
  try {
    const token = getGithubToken();
    res.json({ hasToken: !!token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// PUT /github-token — set a new token (validates via rate limit check)
configRouter.put('/github-token', async (req, res) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    // Temporarily save the token, then validate it
    setGithubToken(token);

    try {
      await getRateLimit();
    } catch {
      // Token is invalid — remove it
      removeGithubToken();
      res.status(400).json({ error: 'Invalid token — could not authenticate with GitHub API' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// DELETE /github-token — remove the configured token
configRouter.delete('/github-token', (_req, res) => {
  try {
    removeGithubToken();
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /rate-limit — current GitHub API rate limit status
configRouter.get('/rate-limit', async (_req, res) => {
  try {
    const rateLimit = await getRateLimit();
    res.json(rateLimit);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /mcp-status — check if GitStore MCP is configured in Claude Desktop config
configRouter.get('/mcp-status', (_req, res) => {
  try {
    const configPath = join(homedir(), '.claude', 'claude_desktop_config.json');
    if (!existsSync(configPath)) {
      res.json({ configured: false, configPath: null });
      return;
    }
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const hasGitstore = !!(config?.mcpServers?.gitstore);
    res.json({ configured: hasGitstore, configPath: hasGitstore ? configPath : null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// POST /mcp-setup — auto-configure GitStore MCP server in Claude's config
configRouter.post('/mcp-setup', (_req, res) => {
  try {
    const configDir = join(homedir(), '.claude');
    const configPath = join(configDir, 'claude_desktop_config.json');
    const mcpEntryPoint = resolve(join(dirname(fileURLToPath(import.meta.url)), '../../mcp/index.js'));

    // Ensure ~/.claude directory exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Read existing config or start fresh
    let config: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf-8');
      config = JSON.parse(raw);
    }

    // Merge mcpServers.gitstore
    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      config.mcpServers = {};
    }
    (config.mcpServers as Record<string, unknown>).gitstore = {
      command: 'node',
      args: [mcpEntryPoint],
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    res.json({ success: true, configPath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
