import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { installApp } from '../../core/installer.js';

export function registerInstallTools(server: McpServer): void {
  server.tool(
    'gitstore_install',
    'Install a GitHub repository as a local application',
    {
      repo: z.string().describe('GitHub repo (owner/name format or full URL)'),
      alias: z.string().optional().describe('Friendly name for the app'),
      ref: z.string().optional().describe('Git ref to install (branch, tag, or commit)'),
    },
    async ({ repo, alias, ref }) => {
      const result = await installApp(repo, { alias, ref });

      const lines: string[] = [
        `✅ **${result.app.fullName}** installed successfully!`,
        '',
        `- **Runtime**: ${result.app.runtime}`,
        `- **Location**: ${result.app.installPath}`,
        `- **Start command**: \`${result.app.startCommand}\``,
      ];

      if (result.app.port) {
        lines.push(`- **Port**: ${result.app.port}`);
      }

      if (result.app.alias) {
        lines.push(`- **Alias**: ${result.app.alias}`);
      }

      if (result.usedDockerFallback) {
        lines.push('', '\u{1F433} Installed using Docker (native runtime not available on this machine).');
      }

      if (result.detection.envVarsRequired.length > 0) {
        lines.push('', `This app requires environment variables: **${result.detection.envVarsRequired.join(', ')}**`, 'Use `gitstore_configure` to set them before starting.');
      }

      lines.push('', 'Use `gitstore_start` to run this app.');

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    }
  );
}
