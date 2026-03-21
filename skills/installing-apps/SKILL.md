---
name: installing-apps
description: Use when the user wants to install a GitHub repository as a local application, provides a GitHub URL to install, or when an installation fails and needs troubleshooting.
---

# Installing Apps with GitStore

Handles the full installation pipeline: inspect, clone, detect runtime, install dependencies, build, and register.

## Workflow

1. **Parse the repo** — accept `owner/repo` format or full GitHub URLs
2. **Inspect first** with `gitstore_inspect` — show the user:
   - Detected runtime and confidence level
   - Risk assessment (especially if medium/high)
   - Prerequisites status
   - Required environment variables
3. **Get confirmation** — especially for medium/high risk repos
4. **Install** with `gitstore_install` — provide alias if the user wants a friendly name
5. **Offer to start** the app after successful installation

## Tool Reference

| Scenario | Tool | Params |
|----------|------|--------|
| Inspect before install | `gitstore_inspect` | `repo: "owner/repo"` |
| Install with defaults | `gitstore_install` | `repo: "owner/repo"` |
| Install with alias | `gitstore_install` | `repo: "owner/repo", alias: "my-app"` |
| Install specific version | `gitstore_install` | `repo: "owner/repo", ref: "v2.0.0"` |
| Start after install | `gitstore_start` | `app: "owner/repo"` |

## Troubleshooting

- **"Missing prerequisites"** — the required runtime (Node.js, Python, Docker) isn't installed on the machine
- **"Could not detect runtime"** — the repo doesn't have a recognized manifest (package.json, requirements.txt, Dockerfile, etc.)
- **"Already installed"** — use `gitstore_update` instead, or `gitstore_uninstall` first
- **Build/install failure** — check `gitstore_logs` for the error output; common causes:
  - Wrong Node/Python version
  - Missing native build dependencies
  - Repo needs environment variables configured
- **High risk score** — explain the risk factors to the user; suggest Docker runtime if a Dockerfile is available

## Safety Notes

- Always show the risk assessment before installing
- For repos with postinstall scripts, warn the user that arbitrary code will run during `npm install`
- For high-risk repos, recommend Docker runtime for isolation
- Never skip the inspect step — it catches issues before they waste time on a failed install
