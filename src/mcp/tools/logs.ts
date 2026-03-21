import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAppLogs } from '../../core/lifecycle.js';
import { findApp } from '../../core/registry.js';

export function registerLogTools(server: McpServer): void {
  server.tool(
    'gitstore_logs',
    'View application logs (stdout/stderr)',
    {
      app: z.string().describe('App ID, alias, or owner/repo'),
      lines: z.number().optional().default(50).describe('Number of log lines to return'),
    },
    async ({ app, lines }) => {
      const appInfo = findApp(app);
      if (!appInfo) {
        return {
          content: [{ type: 'text' as const, text: `App not found: ${app}` }],
          isError: true,
        };
      }

      const logs = getAppLogs(app, lines);

      return {
        content: [{
          type: 'text' as const,
          text: logs
            ? `**Logs for ${appInfo.fullName}** (last ${lines} lines):\n\n\`\`\`\n${logs}\n\`\`\``
            : `No logs found for ${appInfo.fullName}.`,
        }],
      };
    }
  );
}
