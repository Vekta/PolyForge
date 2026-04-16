import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

function expandTilde(p) {
  return p.startsWith('~') ? resolve(homedir(), p.slice(2)) : p;
}

export function projectHash(projectRoot) {
  return createHash('sha256').update(projectRoot).digest('hex').slice(0, 12);
}

export function worktreePath(config, routineName, timestamp, projectRoot) {
  const root = expandTilde(config.isolation.worktree_root);
  const hash = projectHash(projectRoot);
  return resolve(root, hash, routineName, String(timestamp));
}

export function addWorktree(projectRoot, config, routineName) {
  const ts = Math.floor(Date.now() / 1000);
  const path = worktreePath(config, routineName, ts, projectRoot);
  const branch = `routine/${routineName}/${ts}`;
  const parent = resolve(path, '..');
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  execFileSync('git', ['fetch', 'origin', config.isolation.base_branch], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
  execFileSync('git', ['worktree', 'add', '-b', branch, path, config.isolation.base_ref || `origin/${config.isolation.base_branch}`], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
  return { path, branch, timestamp: ts };
}

export function listRoutineWorktrees(projectRoot) {
  const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf-8',
  });
  const blocks = out.split('\n\n').filter(Boolean);
  return blocks
    .map(b => {
      const path = b.match(/^worktree (.+)$/m)?.[1];
      const branch = b.match(/^branch refs\/heads\/(.+)$/m)?.[1];
      return path && branch ? { path, branch } : null;
    })
    .filter(x => x && x.branch.startsWith('routine/'));
}

export function removeWorktree(projectRoot, path) {
  execFileSync('git', ['worktree', 'remove', '--force', path], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
}
