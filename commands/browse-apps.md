---
description: Search and browse GitHub repositories available for installation
argument-hint: [search-query]
---

# Browse Apps

Help the user discover GitHub repositories they can install as local applications.

## Steps

1. Use `gitstore_search` with the provided query (or ask the user what kind of app they need)
2. Present results as a numbered list showing: name, stars, language, description
3. Ask the user if any interest them
4. For selected repos, use `gitstore_inspect` to show detailed analysis including risk assessment
5. Offer to install if everything looks good

## Suggested categories if no query given

- "web framework" — web servers and API frameworks
- "cli tool" — command-line utilities
- "database" — databases and data stores
- "editor" — text/code editors
- "dashboard" — monitoring and admin panels
