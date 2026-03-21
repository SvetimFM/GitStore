import type { RiskAssessment } from '../types/detection.js';
import type { RepoInfo } from '../types/github.js';
import { getRepoFiles, getFileContent } from './github.js';
import { logger } from '../utils/logger.js';

const SUSPICIOUS_FILE_PATTERNS = [
  /^\.env$/,
  /postinstall/i,
  /preinstall/i,
  /keylog/i,
  /reverse.?shell/i,
  /backdoor/i,
];

const SUSPICIOUS_SCRIPT_PATTERNS = [
  /curl\s+.*\|\s*(sh|bash)/i,
  /wget\s+.*\|\s*(sh|bash)/i,
  /eval\s*\(/i,
  /base64\s+(-d|--decode)/i,
  /nc\s+-[elp]/i,       // netcat reverse shell
  /\/dev\/tcp\//i,       // bash tcp redirect
  /\bexec\s*\(/i,
  /child_process/i,
  /process\.env/i,       // accessing env vars in install scripts
];

interface PackageScripts {
  preinstall?: string;
  postinstall?: string;
  install?: string;
  prepare?: string;
  [key: string]: string | undefined;
}

async function checkPackageJsonRisks(
  owner: string,
  repo: string,
  files: string[]
): Promise<{ hasPostinstall: boolean; suspiciousScripts: string[] }> {
  if (!files.includes('package.json')) {
    return { hasPostinstall: false, suspiciousScripts: [] };
  }

  try {
    const content = await getFileContent(owner, repo, 'package.json');
    const pkg = JSON.parse(content) as { scripts?: PackageScripts };
    const scripts = pkg.scripts ?? {};

    const hasPostinstall = !!(scripts.preinstall || scripts.postinstall || scripts.install);
    const suspiciousScripts: string[] = [];

    const lifecycleScripts = ['preinstall', 'postinstall', 'install', 'prepare'];
    for (const name of lifecycleScripts) {
      const script = scripts[name];
      if (!script) continue;

      for (const pattern of SUSPICIOUS_SCRIPT_PATTERNS) {
        if (pattern.test(script)) {
          suspiciousScripts.push(`${name}: "${script}" matches ${pattern}`);
          break;
        }
      }
    }

    return { hasPostinstall, suspiciousScripts };
  } catch {
    return { hasPostinstall: false, suspiciousScripts: [] };
  }
}

function checkFilePatterns(files: string[]): string[] {
  const warnings: string[] = [];
  for (const file of files) {
    for (const pattern of SUSPICIOUS_FILE_PATTERNS) {
      if (pattern.test(file)) {
        warnings.push(`Suspicious file: ${file}`);
        break;
      }
    }
  }
  return warnings;
}

function scoreRepo(repo: RepoInfo): { score: number; reasons: string[] } {
  let score = 50; // neutral baseline
  const reasons: string[] = [];

  // Stars - strong trust signal
  if (repo.stars >= 10000) {
    score -= 30;
    reasons.push(`High star count (${repo.stars.toLocaleString()})`);
  } else if (repo.stars >= 1000) {
    score -= 20;
    reasons.push(`Good star count (${repo.stars.toLocaleString()})`);
  } else if (repo.stars >= 100) {
    score -= 10;
    reasons.push(`Moderate star count (${repo.stars})`);
  } else if (repo.stars < 10) {
    score += 15;
    reasons.push(`Very few stars (${repo.stars}) — less community vetting`);
  }

  // License
  if (repo.license) {
    score -= 5;
  } else {
    score += 10;
    reasons.push('No license — unclear usage terms');
  }

  // Archived
  if (repo.isArchived) {
    score += 10;
    reasons.push('Repository is archived — no longer maintained');
  }

  // Age - older repos with stars are more trustworthy
  const createdAt = new Date(repo.createdAt);
  const ageYears = (Date.now() - createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears >= 3) {
    score -= 5;
  } else if (ageYears < 0.5) {
    score += 10;
    reasons.push('Repository is less than 6 months old');
  }

  // Forks — another trust signal
  if (repo.forks >= 1000) {
    score -= 10;
  } else if (repo.forks >= 100) {
    score -= 5;
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export async function assessRisk(
  owner: string,
  repo: string,
  repoInfo: RepoInfo
): Promise<RiskAssessment> {
  const reasons: string[] = [];

  // 1. Score the repo based on metadata
  const { score: metaScore, reasons: metaReasons } = scoreRepo(repoInfo);
  reasons.push(...metaReasons);

  // 2. Check files for suspicious patterns
  let files: string[] = [];
  try {
    const repoFiles = await getRepoFiles(owner, repo);
    files = repoFiles.map(f => f.name);
  } catch {
    reasons.push('Could not fetch file listing — unable to scan for risks');
  }

  const fileWarnings = checkFilePatterns(files);
  reasons.push(...fileWarnings);

  // 3. Check package.json for risky lifecycle scripts
  const { hasPostinstall, suspiciousScripts } = await checkPackageJsonRisks(owner, repo, files);
  if (hasPostinstall) {
    reasons.push('Has lifecycle scripts (preinstall/postinstall) that run during npm install');
  }
  if (suspiciousScripts.length > 0) {
    reasons.push(...suspiciousScripts.map(s => `Suspicious install script: ${s}`));
  }

  // 4. Check for Dockerfile
  const hasDockerfile = files.includes('Dockerfile') || files.includes('docker-compose.yml');
  if (hasDockerfile) {
    reasons.push('Has Dockerfile — can run in isolated container for safety');
  }

  // 5. Calculate final score
  let finalScore = metaScore;
  finalScore += fileWarnings.length * 5;
  finalScore += suspiciousScripts.length * 15;
  if (hasPostinstall) finalScore += 10;
  finalScore = Math.max(0, Math.min(100, finalScore));

  // 6. Determine level
  let level: RiskAssessment['level'];
  if (finalScore <= 25) {
    level = 'low';
  } else if (finalScore <= 55) {
    level = 'medium';
  } else {
    level = 'high';
  }

  logger.info(`Risk assessment for ${owner}/${repo}: ${level} (score: ${finalScore})`);

  return {
    level,
    score: finalScore,
    reasons,
    hasPostinstallScripts: hasPostinstall,
    hasDockerfile,
  };
}
