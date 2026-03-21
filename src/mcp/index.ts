#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { ensureDirs } from '../utils/paths.js';
import { logger } from '../utils/logger.js';

async function main() {
  ensureDirs();

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info('GitStore MCP server running on stdio');
}

main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
