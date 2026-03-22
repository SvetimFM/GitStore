import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { inspectRepo } from '../../core/installer.js';

export function registerInspectTools(server: McpServer): void {
  server.tool(
    'gitstore_inspect',
    'Analyze a GitHub repo to determine if it can be installed and how',
    {
      repo: z.string().describe('GitHub repo (owner/name format or full URL)'),
    },
    async ({ repo }) => {
      const result = await inspectRepo(repo);

      const lines: string[] = [
        `## ${result.repo.fullName}`,
        '',
        result.repo.description ?? 'No description',
        '',
        `- **Stars**: ${result.repo.stars.toLocaleString()}`,
        `- **Language**: ${result.repo.language ?? 'Unknown'}`,
        `- **License**: ${result.repo.license ?? 'None'}`,
        `- **Last updated**: ${result.repo.updatedAt}`,
        `- **Archived**: ${result.repo.isArchived ? 'Yes' : 'No'}`,
      ];

      if (result.detection) {
        const d = result.detection;
        lines.push(
          '',
          '### Detection',
          `- **Runtime**: ${d.primaryRuntime} (confidence: ${d.confidence})`,
          `- **Manifest**: ${d.manifest}`,
          `- **Install**: \`${d.installCommand}\``,
          `- **Build**: ${d.buildCommand ? `\`${d.buildCommand}\`` : 'None'}`,
          `- **Start**: \`${d.startCommand}\``,
          `- **Port**: ${d.detectedPort ?? 'Not detected'}`,
          `- **Runtime version**: ${d.runtimeVersion ?? 'Any'}`,
        );

        if (d.alternativeRuntimes.length > 0) {
          lines.push(`- **Alternative runtimes**: ${d.alternativeRuntimes.join(', ')}`);
        }

        if (d.envVarsRequired.length > 0) {
          lines.push(`- **Required env vars**: ${d.envVarsRequired.join(', ')}`);
        }
      } else {
        lines.push('', '### Detection', '❌ Could not detect project type. No recognized manifest found.');
      }

      if (result.risk) {
        const r = result.risk;
        const icon = r.level === 'low' ? '🟢' : r.level === 'medium' ? '🟡' : '🔴';
        lines.push(
          '',
          '### Risk Assessment',
          `${icon} **${r.level.toUpperCase()}** (score: ${r.score}/100)`,
        );
        if (r.reasons.length > 0) {
          for (const reason of r.reasons) {
            lines.push(`- ${reason}`);
          }
        }
        if (r.hasDockerfile && r.level !== 'low') {
          lines.push('', '💡 This repo has a Dockerfile — consider using Docker runtime for isolation.');
        }
      }

      if (result.prerequisites) {
        const p = result.prerequisites;
        lines.push(
          '',
          '### Prerequisites',
        );
        if (p.met) {
          lines.push('✅ All prerequisites met');
        } else if (p.fallbackDetection) {
          lines.push(`⚠️ Missing: ${p.missing.join(', ')} — Docker fallback available`);
        } else {
          lines.push(`❌ Missing: ${p.missing.join(', ')}`);
        }
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    }
  );
}
