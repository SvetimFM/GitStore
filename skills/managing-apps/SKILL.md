---
name: managing-apps
description: Use when the user wants to start, stop, update, view logs, check status, or uninstall applications managed by GitStore.
---

# Managing Apps with GitStore

Lifecycle management for installed applications: start, stop, restart, update, logs, uninstall.

## Workflow

1. **Check status** with `gitstore_list` to see what's installed and running
2. **Take action** based on what the user needs
3. **Verify** the action succeeded — check status or logs

## Tool Reference

| Action | Tool | Key Params |
|--------|------|------------|
| List all apps | `gitstore_list` | `status: "all"` |
| List running apps | `gitstore_list` | `status: "running"` |
| Start an app | `gitstore_start` | `app: "owner/repo"`, optional `port`, `env` |
| Stop an app | `gitstore_stop` | `app: "owner/repo"` |
| Restart an app | `gitstore_restart` | `app: "owner/repo"` |
| Update to latest | `gitstore_update` | `app: "owner/repo"` |
| View logs | `gitstore_logs` | `app: "owner/repo"`, optional `lines` |
| Uninstall | `gitstore_uninstall` | `app: "owner/repo"`, optional `keepData` |

## App Identifiers

Apps can be referenced by:
- **Full name**: `owner/repo` (e.g., `expressjs/express`)
- **Alias**: if one was set during install (e.g., `my-api`)
- **ID**: the UUID assigned at install time

## Common Scenarios

### App won't start
1. `gitstore_logs` — check for errors
2. Common issues: port already in use, missing env vars, missing runtime
3. Try with a different port: `gitstore_start` with `port: 3001`

### App crashed
1. `gitstore_list` — it will show status "stopped" if the process died
2. `gitstore_logs` — check the last output
3. `gitstore_restart` to try again

### Updating an app
1. `gitstore_update` — pulls latest code, reinstalls deps, rebuilds
2. If the app was running, you'll need to restart it after update

### Freeing up space
1. `gitstore_list` — see all installed apps
2. `gitstore_uninstall` — removes app files and registry entry
3. Use `keepData: true` to keep the cloned files on disk
