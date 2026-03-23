#!/usr/bin/env node

import { cmdServe, cmdSearch, cmdInstall, cmdList, cmdStart, cmdStop, cmdInspect, cmdCurate } from './cli/commands.js';
import { bold, dim, cyan } from './cli/format.js';

const VERSION = '0.3.0';

const args = process.argv.slice(2);

function printHelp(): void {
  console.log(`
${bold(cyan('GitStore'))} ${dim(`v${VERSION}`)} — App store for GitHub

${bold('Usage:')}
  gitstore [command] [options]

${bold('Commands:')}
  serve               Start the GitStore server with web UI (default)
  search <query>      Search GitHub repositories
  install <repo>      Install a repo as a local app
  list, ls            List installed apps
  start <app>         Start an installed app
  stop <app>          Stop a running app
  inspect <repo>      Inspect a repo before installing
  curate [source]     Import collections from awesome-lists

${bold('Options:')}
  --port <n>          Port for the web server (default: 3000)
  --help, -h          Show this help message
  --version, -v       Show version

${bold('Examples:')}
  gitstore                          Start the web UI
  gitstore search "express api"     Search for repos
  gitstore install tj/commander     Install a repo
  gitstore install sharkdp/bat@v0.24.0  Install a specific version
  gitstore list                     Show installed apps
  gitstore start tj/commander       Start an app
  gitstore curate all               Import from all sources
  gitstore curate user/awesome-x    Preview an awesome-list
  gitstore curate user/awesome-x:ai-llm  Import into a category
`);
}

async function main(): Promise<void> {
  // Handle flags first
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(VERSION);
    return;
  }

  // Parse --port flag
  let port = 3000;
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1) {
    const portVal = args[portIdx + 1];
    if (portVal) {
      port = parseInt(portVal, 10);
      if (isNaN(port)) {
        console.error('Error: --port requires a numeric value');
        process.exit(1);
      }
    }
    args.splice(portIdx, 2);
  }

  const command = args[0] ?? 'serve';

  switch (command) {
    case 'serve':
      await cmdServe(port);
      break;

    case 'search': {
      const query = args.slice(1).join(' ');
      if (!query) {
        console.error('Usage: gitstore search <query>');
        process.exit(1);
      }
      await cmdSearch(query);
      break;
    }

    case 'install': {
      const repo = args[1];
      if (!repo) {
        console.error('Usage: gitstore install <owner/repo>');
        process.exit(1);
      }
      await cmdInstall(repo);
      break;
    }

    case 'list':
    case 'ls':
      await cmdList();
      break;

    case 'start': {
      const app = args[1];
      if (!app) {
        console.error('Usage: gitstore start <app>');
        process.exit(1);
      }
      await cmdStart(app);
      break;
    }

    case 'stop': {
      const app = args[1];
      if (!app) {
        console.error('Usage: gitstore stop <app>');
        process.exit(1);
      }
      await cmdStop(app);
      break;
    }

    case 'inspect': {
      const repo = args[1];
      if (!repo) {
        console.error('Usage: gitstore inspect <owner/repo>');
        process.exit(1);
      }
      await cmdInspect(repo);
      break;
    }

    case 'curate': {
      const source = args[1];
      await cmdCurate(source);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${msg}`);
  process.exit(1);
});
