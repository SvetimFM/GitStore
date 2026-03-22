import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { findApp, getAppEnv, setAppEnvBulk } from '../../core/registry.js';

export function registerConfigureTools(server: McpServer): void {
  server.tool(
    'gitstore_configure',
    'Set environment variables for an installed app',
    {
      app: z.string().describe('App ID, alias, or owner/repo'),
      env: z.record(z.string()).describe('Environment variables to set (key-value pairs)'),
      secret: z.boolean().optional().default(false).describe('Mark these variables as secrets (values will be masked in output)'),
    },
    async ({ app, env, secret }) => {
      const found = findApp(app);
      if (!found) {
        return {
          content: [{ type: 'text' as const, text: `App not found: ${app}` }],
          isError: true,
        };
      }

      setAppEnvBulk(found.id, env, secret);
      const allVars = getAppEnv(found.id);

      const lines: string[] = [
        `Configured environment for **${found.fullName}**:`,
        '',
      ];

      for (const v of allVars) {
        const display = v.isSecret ? '********' : v.value;
        lines.push(`- \`${v.key}\` = \`${display}\``);
      }

      if (found.envVarsRequired.length > 0) {
        const configured = allVars.map(v => v.key);
        const missing = found.envVarsRequired.filter(k => !configured.includes(k));
        if (missing.length > 0) {
          lines.push('', `Still missing required vars: **${missing.join(', ')}**`);
        } else {
          lines.push('', 'All required environment variables are configured.');
        }
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    }
  );

  server.tool(
    'gitstore_env',
    'View stored environment variables for an app',
    {
      app: z.string().describe('App ID, alias, or owner/repo'),
    },
    async ({ app }) => {
      const found = findApp(app);
      if (!found) {
        return {
          content: [{ type: 'text' as const, text: `App not found: ${app}` }],
          isError: true,
        };
      }

      const allVars = getAppEnv(found.id);

      if (allVars.length === 0 && found.envVarsRequired.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No environment variables configured for **${found.fullName}**.` }],
        };
      }

      const lines: string[] = [
        `Environment for **${found.fullName}**:`,
        '',
      ];

      if (allVars.length > 0) {
        for (const v of allVars) {
          const display = v.isSecret ? '********' : v.value;
          lines.push(`- \`${v.key}\` = \`${display}\``);
        }
      } else {
        lines.push('No variables configured yet.');
      }

      if (found.envVarsRequired.length > 0) {
        const configured = allVars.map(v => v.key);
        const missing = found.envVarsRequired.filter(k => !configured.includes(k));
        if (missing.length > 0) {
          lines.push('', `Required but not yet configured: **${missing.join(', ')}**`);
          lines.push('Use `gitstore_configure` to set them.');
        } else {
          lines.push('', 'All required environment variables are configured.');
        }
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    }
  );
}
