import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getCategories,
  getCollections,
  getCollection,
  enrichCollectionRepos,
  enrichFeatured,
} from '../../core/collections.js';

export function registerBrowseTools(server: McpServer): void {
  server.tool(
    'gitstore_browse',
    'Browse curated collections, categories, and featured apps in the GitStore',
    {
      categoryId: z.string().optional().describe('Filter collections by category ID'),
      collectionId: z.string().optional().describe('Get enriched details of a specific collection'),
      showFeatured: z.boolean().optional().describe('Show featured apps'),
    },
    async ({ categoryId, collectionId, showFeatured }) => {
      // Show featured apps
      if (showFeatured) {
        const featured = await enrichFeatured();
        const formatted = featured.map((app, i) => {
          const stars = app.info
            ? app.info.stars >= 1000
              ? `${(app.info.stars / 1000).toFixed(1)}k`
              : String(app.info.stars)
            : '?';
          const lang = app.info?.language ? ` [${app.info.language}]` : '';
          return `${i + 1}. **${app.fullName}** ⭐${stars}${lang}\n   ${app.tagline ?? app.info?.description ?? 'No description'}`;
        });
        return {
          content: [{
            type: 'text' as const,
            text: `Featured Apps:\n\n${formatted.join('\n\n')}`,
          }],
        };
      }

      // Show enriched collection detail
      if (collectionId) {
        const collection = getCollection(collectionId);
        if (!collection) {
          return {
            content: [{
              type: 'text' as const,
              text: `Collection "${collectionId}" not found.`,
            }],
          };
        }
        const enriched = await enrichCollectionRepos(collection);
        const formatted = enriched.repos.map((repo, i) => {
          const stars = repo.info
            ? repo.info.stars >= 1000
              ? `${(repo.info.stars / 1000).toFixed(1)}k`
              : String(repo.info.stars)
            : '?';
          const lang = repo.info?.language ? ` [${repo.info.language}]` : '';
          return `${i + 1}. **${repo.fullName}** ⭐${stars}${lang}\n   ${repo.note ?? repo.info?.description ?? 'No description'}`;
        });
        return {
          content: [{
            type: 'text' as const,
            text: `Collection: ${enriched.name}\n${enriched.description ?? ''}\n\n${formatted.join('\n\n')}`,
          }],
        };
      }

      // Show collections in a category
      if (categoryId) {
        const collections = getCollections(categoryId);
        const categories = getCategories();
        const category = categories.find(c => c.id === categoryId);
        if (!category) {
          return {
            content: [{
              type: 'text' as const,
              text: `Category "${categoryId}" not found.`,
            }],
          };
        }
        const formatted = collections.map((col, i) => {
          return `${i + 1}. **${col.name}** (${col.repos.length} repos)\n   ${col.description ?? 'No description'}`;
        });
        return {
          content: [{
            type: 'text' as const,
            text: `${category.icon} ${category.name}: ${category.description}\n\nCollections:\n\n${formatted.join('\n\n')}`,
          }],
        };
      }

      // Default: list all categories with collection counts
      const categories = getCategories();
      const allCollections = getCollections();
      const formatted = categories.map((cat, i) => {
        const count = allCollections.filter(c => c.categoryId === cat.id).length;
        return `${i + 1}. ${cat.icon} **${cat.name}** (${count} collections)\n   ${cat.description}`;
      });
      return {
        content: [{
          type: 'text' as const,
          text: `GitStore Categories:\n\n${formatted.join('\n\n')}\n\nUse categoryId to explore a category, collectionId to see repos, or showFeatured for featured apps.`,
        }],
      };
    }
  );
}
