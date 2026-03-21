import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { startApp, stopApp, restartApp } from '../../core/lifecycle.js';
import { updateApp, uninstallApp } from '../../core/installer.js';

export function registerLifecycleTools(server: McpServer): void {
  server.tool(
    'gitstore_start',
    'Start an installed application',
    {
      app: z.string().describe('App ID, alias, or owner/repo'),
      port: z.number().optional().describe('Override default port'),
      env: z.record(z.string()).optional().describe('Environment variables to set'),
    },
    async ({ app, port, env }) => {
      const result = await startApp(app, { port, env });
      const portInfo = result.port ? ` on port ${result.port}` : '';
      return {
        content: [{
          type: 'text' as const,
          text: `▶️ **${result.fullName}** started (PID: ${result.pid})${portInfo}\n\nUse \`gitstore_logs\` to view output, \`gitstore_stop\` to stop.`,
        }],
      };
    }
  );

  server.tool(
    'gitstore_stop',
    'Stop a running application',
    {
      app: z.string().describe('App ID, alias, or owner/repo'),
    },
    async ({ app }) => {
      const result = await stopApp(app);
      return {
        content: [{
          type: 'text' as const,
          text: `⏹️ **${result.fullName}** stopped.`,
        }],
      };
    }
  );

  server.tool(
    'gitstore_restart',
    'Restart a running application',
    {
      app: z.string().describe('App ID, alias, or owner/repo'),
    },
    async ({ app }) => {
      const result = await restartApp(app);
      return {
        content: [{
          type: 'text' as const,
          text: `🔄 **${result.fullName}** restarted (PID: ${result.pid}).`,
        }],
      };
    }
  );

  server.tool(
    'gitstore_update',
    'Update an installed app to the latest version',
    {
      app: z.string().describe('App ID, alias, or owner/repo'),
    },
    async ({ app }) => {
      const result = await updateApp(app);
      return {
        content: [{
          type: 'text' as const,
          text: `📦 **${result.fullName}** updated successfully.`,
        }],
      };
    }
  );

  server.tool(
    'gitstore_uninstall',
    'Remove an installed application',
    {
      app: z.string().describe('App ID, alias, or owner/repo'),
      keepData: z.boolean().optional().default(false).describe('Keep app files on disk'),
    },
    async ({ app, keepData }) => {
      await uninstallApp(app, keepData);
      return {
        content: [{
          type: 'text' as const,
          text: `🗑️ **${app}** uninstalled.${keepData ? ' App files were kept on disk.' : ''}`,
        }],
      };
    }
  );
}
