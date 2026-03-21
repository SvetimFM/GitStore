import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listApps } from '../../core/registry.js';
import { isProcessRunning } from '../../utils/process-manager.js';
import { updateAppStatus } from '../../core/registry.js';

export function registerListTools(server: McpServer): void {
  server.tool(
    'gitstore_list',
    'List installed applications and their status',
    {
      status: z.enum(['all', 'running', 'stopped', 'installed', 'error']).optional().default('all').describe('Filter by status'),
    },
    async ({ status }) => {
      const apps = listApps(status === 'all' ? undefined : status as any);

      // Sync running statuses (check if PIDs are still alive)
      for (const app of apps) {
        if (app.status === 'running' && app.pid && !isProcessRunning(app.pid)) {
          updateAppStatus(app.id, 'stopped');
          app.status = 'stopped';
          app.pid = null;
        }
      }

      if (apps.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No apps installed. Use `gitstore_search` to find apps and `gitstore_install` to install them.',
          }],
        };
      }

      const statusIcon: Record<string, string> = {
        running: '🟢',
        installed: '⚪',
        stopped: '⚫',
        error: '🔴',
        installing: '🔵',
      };

      const formatted = apps.map(app => {
        const icon = statusIcon[app.status] ?? '❓';
        const port = app.port ? ` :${app.port}` : '';
        const pid = app.pid ? ` PID:${app.pid}` : '';
        const alias = app.alias ? ` (${app.alias})` : '';
        return `${icon} **${app.fullName}**${alias} [${app.runtime}]${port}${pid}\n   Status: ${app.status} | Installed: ${app.installedAt.split('T')[0]}`;
      });

      return {
        content: [{
          type: 'text' as const,
          text: `**Installed Apps** (${apps.length}):\n\n${formatted.join('\n\n')}`,
        }],
      };
    }
  );
}
