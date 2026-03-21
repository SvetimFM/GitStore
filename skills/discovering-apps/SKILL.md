---
name: discovering-apps
description: Use when the user wants to find, search, or browse GitHub repositories to install as applications. Triggered by requests like "find me an app", "search for a tool", "what apps are available", or "I need something that does X".
---

# Discovering Apps with GitStore

GitStore lets users find GitHub repositories and install them as local applications. Use the MCP tools below to search and evaluate repos before installation.

## Workflow

1. **Understand what the user needs** — ask clarifying questions if the request is vague
2. **Search** with `gitstore_search` using relevant keywords, optionally filtering by language or minimum stars
3. **Present results** as a clear list with star counts, languages, and descriptions
4. **Inspect** promising repos with `gitstore_inspect` to get detection details and risk assessment
5. **Advise** the user based on the risk level, prerequisites, and detected runtime
6. **Offer to install** if the user is interested

## Tool Reference

| Want to... | Tool | Example |
|------------|------|---------|
| Search by keyword | `gitstore_search` | `query: "markdown editor"` |
| Filter by language | `gitstore_search` | `query: "web server", language: "Rust"` |
| Filter by popularity | `gitstore_search` | `query: "cli tool", minStars: 500` |
| Get full repo analysis | `gitstore_inspect` | `repo: "owner/repo"` |
| See installed apps | `gitstore_list` | `status: "all"` |

## Tips

- Start broad, then narrow. Search with general terms first, then use language/stars filters.
- Always inspect before recommending installation — the risk assessment and prerequisites check will surface issues early.
- If the user provides a GitHub URL, go straight to `gitstore_inspect`.
- Present at most 5 results at a time to avoid overwhelming the user.
- Highlight the risk level prominently — if it's medium or high, explain why and suggest Docker runtime if available.
