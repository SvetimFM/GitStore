import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSearchTools } from './tools/search.js';
import { registerInspectTools } from './tools/inspect.js';
import { registerInstallTools } from './tools/install.js';
import { registerLifecycleTools } from './tools/lifecycle.js';
import { registerListTools } from './tools/list.js';
import { registerLogTools } from './tools/logs.js';
import { registerConfigureTools } from './tools/configure.js';
import { registerBrowseTools } from './tools/browse.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'gitstore',
    version: '0.1.0',
  });

  registerSearchTools(server);
  registerInspectTools(server);
  registerInstallTools(server);
  registerLifecycleTools(server);
  registerListTools(server);
  registerLogTools(server);
  registerConfigureTools(server);
  registerBrowseTools(server);

  return server;
}
