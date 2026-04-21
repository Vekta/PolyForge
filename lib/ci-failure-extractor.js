import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const DEFAULT_EXCLUDE_PATTERNS = [
  '^deploy',
  '^release',
  '^npm publish',
  '^docker push',
  '^gh release',
  '^aws',
  '^gcloud',
  '^heroku',
  'uses:',
];

export function extractFailingCommand(runLog) {
  if (!runLog) return null;
  const lines = runLog.split('\n');
  let lastRunCommand = null;
  for (let i = 0; i < lines.length; i++) {
    const groupMatch = lines[i].match(/^##\[group\]Run\s+(.+)$/);
    if (groupMatch) {
      lastRunCommand = groupMatch[1].trim();
      continue;
    }
    if (lines[i].match(/^##\[error\]/)) {
      if (lastRunCommand) return lastRunCommand;
    }
  }
  return lastRunCommand;
}

export function fetchFailedRunLog(projectRoot, prNumber) {
  try {
    const runs = execFileSync('gh', ['run', 'list', '--repo', repoFromPr(projectRoot, prNumber),
      '--json', 'databaseId,conclusion,headBranch', '--limit', '5'], {
      cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    const list = JSON.parse(runs);
    const failed = list.find(r => r.conclusion === 'failure');
    if (!failed) return null;
    const log = execFileSync('gh', ['run', 'view', String(failed.databaseId), '--log-failed'], {
      cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    return { runId: failed.databaseId, log };
  } catch {
    return null;
  }
}

function repoFromPr(projectRoot, prNumber) {
  try {
    const out = execFileSync('gh', ['pr', 'view', String(prNumber), '--json', 'headRepository,headRepositoryOwner'], {
      cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(out);
    return `${parsed.headRepositoryOwner?.login}/${parsed.headRepository?.name}`;
  } catch {
    return '';
  }
}

export function shouldLearn(cmd, userExcludePatterns = []) {
  if (!cmd || !cmd.trim()) return false;
  const patterns = [...DEFAULT_EXCLUDE_PATTERNS, ...userExcludePatterns];
  for (const p of patterns) {
    try {
      if (new RegExp(p).test(cmd)) return false;
    } catch {
      // skip invalid regex, shouldn't happen if schema validated
    }
  }
  return true;
}

export function projectHash(projectRoot) {
  return createHash('sha256').update(projectRoot).digest('hex').slice(0, 12);
}

export function appendLearnedCommand({ projectRoot, cmd, fromRunUrl }) {
  const dir = resolve(homedir(), '.polyforge');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'learned-commands.jsonl');
  const entry = {
    projectHash: projectHash(projectRoot),
    projectRoot,
    cmd,
    name: cmd.split(/\s+/)[0],
    learnedAt: new Date().toISOString(),
    fromRun: fromRunUrl || null,
  };
  appendFileSync(path, JSON.stringify(entry) + '\n');
  return { appended: true, path, entry };
}

export function readLearnedCommands() {
  const path = resolve(homedir(), '.polyforge', 'learned-commands.jsonl');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

export { DEFAULT_EXCLUDE_PATTERNS };
