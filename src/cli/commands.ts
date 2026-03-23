import { createExpressApp } from '../server/index.js';
import { searchRepos } from '../core/github.js';
import { installApp, inspectRepo, uninstallApp, updateApp } from '../core/installer.js';
import { startApp, stopApp, restartApp, getAppLogs, syncStatuses } from '../core/lifecycle.js';
import { listApps } from '../core/registry.js';
import { curateFromSource, curateAll, fetchAwesomeList, PREDEFINED_SOURCES, type CurateSource } from '../core/curate.js';
import { ensureDirs } from '../utils/paths.js';
import { bold, dim, green, yellow, red, cyan, table, banner } from './format.js';
import { openBrowser } from './open-browser.js';

/** Start the GitStore server with web UI. */
export async function cmdServe(port: number): Promise<void> {
  ensureDirs();

  const app = createExpressApp();
  const url = `http://localhost:${port}`;

  const server = app.listen(port, () => {
    console.log(banner());
    console.log(`  ${green('Server running at')} ${bold(url)}`);
    console.log(`  ${dim('Press Ctrl+C to stop')}\n`);
    openBrowser(url);
  });

  const shutdown = () => {
    console.log(`\n${dim('Shutting down...')}`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/** Search GitHub repos. */
export async function cmdSearch(query: string): Promise<void> {
  console.log(dim(`Searching for "${query}"...\n`));

  const result = await searchRepos(query, { limit: 10 });

  if (result.repos.length === 0) {
    console.log(yellow('No repositories found.'));
    return;
  }

  const headers = ['Repository', 'Stars', 'Language', 'Description'];
  const rows = result.repos.map(r => [
    r.fullName,
    String(r.stars),
    r.language ?? '-',
    (r.description ?? '').slice(0, 60),
  ]);

  console.log(table(headers, rows));
  console.log(dim(`\n${result.totalCount} result(s)`));
}

/** Install a repo as a local app. */
export async function cmdInstall(repoStr: string): Promise<void> {
  console.log(dim(`Installing ${repoStr}...\n`));

  const result = await installApp(repoStr);

  console.log(green(`Installed ${bold(result.app.fullName)}`));
  console.log(`  Runtime:  ${result.detection.primaryRuntime}`);
  if (result.app.installType === 'binary') {
    console.log(`  Version:  ${result.app.installedRef}`);
    console.log(`  Binary:   ${dim(result.app.startCommand)}`);
  } else {
    console.log(`  Path:     ${dim(result.app.installPath)}`);
  }
  if (result.app.port) {
    console.log(`  Port:     ${result.app.port}`);
  }
  console.log(`\nRun ${cyan(`gitstore start ${result.app.fullName}`)} to launch it.`);
}

/** List installed apps. */
export async function cmdList(): Promise<void> {
  syncStatuses();
  const apps = listApps();

  if (apps.length === 0) {
    console.log(yellow('No apps installed.'));
    console.log(dim('Use "gitstore search <query>" to find repos, then "gitstore install <owner/repo>" to install.'));
    return;
  }

  const statusColor = (s: string) => {
    switch (s) {
      case 'running': return green(s);
      case 'stopped': return dim(s);
      case 'error':   return red(s);
      default:        return yellow(s);
    }
  };

  const headers = ['App', 'Status', 'Runtime', 'Port', 'Description'];
  const rows = apps.map(a => [
    a.fullName,
    statusColor(a.status),
    a.runtime,
    a.port ? String(a.port) : '-',
    (a.description ?? '').slice(0, 50),
  ]);

  console.log(table(headers, rows));
}

/** Start an installed app. */
export async function cmdStart(appId: string): Promise<void> {
  console.log(dim(`Starting ${appId}...`));
  const app = await startApp(appId);
  console.log(green(`Started ${bold(app.fullName)}`) + ` (PID: ${app.pid})`);
  if (app.port) {
    console.log(`  ${dim('Running at')} http://localhost:${app.port}`);
  }
}

/** Stop a running app. */
export async function cmdStop(appId: string): Promise<void> {
  console.log(dim(`Stopping ${appId}...`));
  const app = await stopApp(appId);
  console.log(green(`Stopped ${bold(app.fullName)}`));
}

/** Uninstall an app. */
export async function cmdUninstall(appId: string, keepData: boolean): Promise<void> {
  console.log(dim(`Uninstalling ${appId}...`));
  await uninstallApp(appId, keepData);
  console.log(green(`Uninstalled ${bold(appId)}`));
  if (keepData) {
    console.log(dim('  App files were preserved.'));
  }
}

/** Update an installed app to latest version. */
export async function cmdUpdate(appId: string): Promise<void> {
  console.log(dim(`Updating ${appId}...`));
  const app = await updateApp(appId);
  console.log(green(`Updated ${bold(app.fullName)}`));
  if (app.installedRef) {
    console.log(`  Version: ${app.installedRef}`);
  }
}

/** Restart a running app. */
export async function cmdRestart(appId: string): Promise<void> {
  console.log(dim(`Restarting ${appId}...`));
  const app = await restartApp(appId);
  console.log(green(`Restarted ${bold(app.fullName)}`) + ` (PID: ${app.pid})`);
  if (app.port) {
    console.log(`  ${dim('Running at')} http://localhost:${app.port}`);
  }
}

/** View app logs. */
export async function cmdLogs(appId: string, lines: number): Promise<void> {
  const output = getAppLogs(appId, lines);
  if (!output) {
    console.log(dim('No logs available.'));
    return;
  }
  console.log(output);
}

/** Curate collections from awesome-lists. */
export async function cmdCurate(sourceArg?: string): Promise<void> {
  if (!sourceArg || sourceArg === 'all') {
    console.log(dim('Curating from all predefined sources...\n'));
    const results = await curateAll();
    for (const r of results) {
      console.log(`${green('✓')} ${bold(r.source)}: ${r.collectionsCreated} new, ${r.collectionsUpdated} updated (${r.reposFound} repos from ${r.sectionsFound} sections)`);
    }
    console.log(dim(`\nDone. Restart the server to see changes.`));
    return;
  }

  const predefined = PREDEFINED_SOURCES.find(s => s.repo === sourceArg || s.repo.endsWith(`/${sourceArg}`));
  if (predefined) {
    console.log(dim(`Curating from ${predefined.repo}...\n`));
    const result = await curateFromSource(predefined);
    console.log(`${green('✓')} ${result.collectionsCreated} collections created, ${result.collectionsUpdated} updated`);
    console.log(`  ${result.reposFound} repos from ${result.sectionsFound} sections`);
    return;
  }

  if (sourceArg.includes('/')) {
    const [repo, categoryId] = sourceArg.split(':');
    if (!categoryId) {
      console.log(dim(`Fetching ${repo} to preview sections...\n`));
      const sections = await fetchAwesomeList(repo);
      console.log(bold(`Found ${sections.length} sections:\n`));
      for (const s of sections.slice(0, 30)) {
        console.log(`  ${s.name} ${dim(`(${s.repos.length} repos)`)}`);
      }
      if (sections.length > 30) console.log(dim(`  ... and ${sections.length - 30} more`));
      console.log(`\n${dim('To import, run:')} ${cyan(`gitstore curate ${repo}:<categoryId>`)}`);
      return;
    }

    const source: CurateSource = { repo, categoryId, maxReposPerSection: 6, minReposPerSection: 2 };
    console.log(dim(`Curating from ${repo} → ${categoryId}...\n`));
    const result = await curateFromSource(source);
    console.log(`${green('✓')} ${result.collectionsCreated} collections created, ${result.collectionsUpdated} updated`);
    console.log(`  ${result.reposFound} repos from ${result.sectionsFound} sections`);
    return;
  }

  console.error(red('Usage: gitstore curate [all | owner/repo | owner/repo:categoryId]'));
  process.exit(1);
}

/** Inspect a repo before installing. */
export async function cmdInspect(repoStr: string): Promise<void> {
  console.log(dim(`Inspecting ${repoStr}...\n`));

  const result = await inspectRepo(repoStr);

  console.log(bold(result.repo.fullName));
  console.log(`  ${dim(result.repo.description ?? 'No description')}`);
  console.log(`  Stars: ${result.repo.stars}  Forks: ${result.repo.forks}  Language: ${result.repo.language ?? '-'}`);

  if (result.detection) {
    console.log(`\n${bold('Detection')}`);
    if (result.detection.installType === 'binary' && result.detection.binaryAsset) {
      console.log(`  Install:   ${green('Pre-built binary available')}`);
      console.log(`  Asset:     ${result.detection.binaryAsset.name}`);
      console.log(`  Version:   ${result.detection.binaryAsset.tagName}`);
      console.log(`  Size:      ${(result.detection.binaryAsset.size / 1024 / 1024).toFixed(1)} MB`);
    } else {
      console.log(`  Runtime:   ${result.detection.primaryRuntime} (${result.detection.confidence} confidence)`);
      console.log(`  Manifest:  ${result.detection.manifest}`);
      console.log(`  Start:     ${result.detection.startCommand}`);
      if (result.detection.buildCommand) {
        console.log(`  Build:     ${result.detection.buildCommand}`);
      }
      if (result.detection.detectedPort) {
        console.log(`  Port:      ${result.detection.detectedPort}`);
      }
    }
  } else {
    console.log(yellow('\n  Could not detect how to run this repository.'));
  }

  if (result.risk) {
    const riskColor = result.risk.level === 'low' ? green : result.risk.level === 'medium' ? yellow : red;
    console.log(`\n${bold('Risk Assessment')}`);
    console.log(`  Level: ${riskColor(result.risk.level)} (score: ${result.risk.score}/100)`);
    for (const reason of result.risk.reasons) {
      console.log(`  ${dim('-')} ${reason}`);
    }
  }
}
