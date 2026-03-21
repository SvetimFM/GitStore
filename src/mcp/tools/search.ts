import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { searchRepos } from '../../core/github.js';

export function registerSearchTools(server: McpServer): void {
  server.tool(
    'gitstore_search',
    'Search GitHub for installable applications',
    {
      query: z.string().describe('Search query (natural language or GitHub search syntax)'),
      language: z.string().optional().describe('Filter by programming language'),
      minStars: z.number().optional().describe('Minimum star count'),
      topic: z.string().optional().describe('Filter by GitHub topic'),
      limit: z.number().optional().default(10).describe('Number of results (max 30)'),
    },
    async ({ query, language, minStars, topic, limit }) => {
      const results = await searchRepos(query, {
        language,
        minStars,
        topic,
        limit: Math.min(limit ?? 10, 30),
      });

      const formatted = results.repos.map((r, i) => {
        const stars = r.stars >= 1000 ? `${(r.stars / 1000).toFixed(1)}k` : String(r.stars);
        const lang = r.language ? ` [${r.language}]` : '';
        const archived = r.isArchived ? ' (ARCHIVED)' : '';
        return `${i + 1}. **${r.fullName}** ⭐${stars}${lang}${archived}\n   ${r.description ?? 'No description'}\n   Topics: ${r.topics.length > 0 ? r.topics.join(', ') : 'none'}`;
      });

      return {
        content: [{
          type: 'text' as const,
          text: results.repos.length > 0
            ? `Found ${results.totalCount} repos:\n\n${formatted.join('\n\n')}`
            : 'No repos found matching your query.',
        }],
      };
    }
  );
}
