---
name: discovering-apps
description: Use when the user wants to find, search, or browse GitHub repositories to install as applications. Triggered by requests like "find me an app", "search for a tool", "what apps are available", or "I need something that does X".
---

# Discovering Apps with GitStore

GitStore lets users find GitHub repositories and install them as local applications. Use the MCP tools below to search and evaluate repos before installation.

## Workflow

1. **Understand what the user needs** — ask clarifying questions if the request is vague
2. **Browse curated content** with `gitstore_browse` — check featured apps and relevant categories first
3. **Search** with `gitstore_search` if browsing didn't surface a good match, using relevant keywords and filters
4. **Present results** as a clear list with star counts, languages, and descriptions
5. **Inspect** promising repos with `gitstore_inspect` to get detection details and risk assessment
6. **Advise** the user based on the risk level, prerequisites, and detected runtime
7. **Offer to install** if the user is interested

## Tool Reference

| Want to... | Tool | Example |
|------------|------|---------|
| Browse all categories | `gitstore_browse` | *(no args)* |
| Browse by category | `gitstore_browse` | `categoryId: "web-frameworks"` |
| View a collection | `gitstore_browse` | `collectionId: "popular-web-frameworks"` |
| See featured apps | `gitstore_browse` | `showFeatured: true` |
| Search by keyword | `gitstore_search` | `query: "markdown editor"` |
| Filter by language | `gitstore_search` | `query: "web server", language: "Rust"` |
| Filter by popularity | `gitstore_search` | `query: "cli tool", minStars: 500` |
| Get full repo analysis | `gitstore_inspect` | `repo: "owner/repo"` |
| See installed apps | `gitstore_list` | `status: "all"` |

## Tips

- Start with `gitstore_browse` for curated recommendations before falling back to keyword search.
- Start broad, then narrow. Search with general terms first, then use language/stars filters.
- Always inspect before recommending installation — the risk assessment and prerequisites check will surface issues early.
- If the user provides a GitHub URL, go straight to `gitstore_inspect`.
- Present at most 5 results at a time to avoid overwhelming the user.
- Highlight the risk level prominently — if it's medium or high, explain why and suggest Docker runtime if available.
