---
description: Install a GitHub repository as a local application
argument-hint: [github-url-or-owner/repo]
---

# Install App

Install a GitHub repository as a locally running application.

## Steps

1. Parse the argument as a GitHub repo identifier (owner/repo or full URL)
2. Use `gitstore_inspect` to analyze the repo:
   - Show the detected runtime, build/start commands
   - Show the risk assessment with score and reasons
   - Show whether prerequisites are met
3. Present a clear summary to the user
4. If the user confirms (or risk is low), use `gitstore_install` to install
5. After installation succeeds, ask if the user wants to start the app
6. If yes, use `gitstore_start` and report the result (including URL/port if applicable)

## If no argument is provided

Ask the user what they'd like to install. You can also suggest using `gitstore_search` to find apps.
