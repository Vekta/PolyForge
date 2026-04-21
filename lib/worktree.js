import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_ROOT = resolve(homedir(), '.polyforge', 'worktrees');

export function projectHash(projectRoot) {
  return createHash('sha256').update(projectRoot).digest('hex').slice(0, 12);
}

export function expandTilde(p) {
  if (!p) return null;
  return p.startsWith('~') ? resolve(homedir(), p.slice(2)) : p;
}

export function buildPath({ root = DEFAULT_ROOT, projectRoot, namespace, name, timestamp }) {
  const hash = projectHash(projectRoot);
  const ts = timestamp || Math.floor(Date.now() / 1000);
  return { path: resolve(root, hash, namespace, name, String(ts)), timestamp: ts };
}

export function addWorktree({
  projectRoot,
  baseBranch = 'main',
  baseRef = null,
  branchPrefix,
  branchName,
  path,
  fetchFirst = true,
}) {
  const fullBranch = branchPrefix ? `${branchPrefix}/${branchName}` : branchName;
  const ref = baseRef || `origin/${baseBranch}`;
  if (fetchFirst) {
    execFileSync('git', ['fetch', 'origin', baseBranch], {
      cwd: projectRoot, stdio: 'pipe', timeout: 15000,
    });
  }
  const parent = resolve(path, '..');
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  execFileSync('git', ['worktree', 'add', '-b', fullBranch, path, ref], {
    cwd: projectRoot, stdio: 'pipe', timeout: 20000,
  });
  return { path, branch: fullBranch };
}

export function listWorktrees(projectRoot, { branchPrefix } = {}) {
  const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: projectRoot, encoding: 'utf-8', timeout: 5000,
  });
  const blocks = out.split('\n\n').filter(Boolean);
  return blocks
    .map(b => {
      const path = b.match(/^worktree (.+)$/m)?.[1];
      const branch = b.match(/^branch refs\/heads\/(.+)$/m)?.[1];
      return path && branch ? { path, branch } : null;
    })
    .filter(x => x && (!branchPrefix || x.branch.startsWith(branchPrefix + '/')));
}

export function removeWorktree(projectRoot, path) {
  execFileSync('git', ['worktree', 'remove', '--force', path], {
    cwd: projectRoot, stdio: 'pipe', timeout: 10000,
  });
}

export function deleteBranch(projectRoot, branch) {
  try {
    execFileSync('git', ['branch', '-D', branch], {
      cwd: projectRoot, stdio: 'pipe', timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

export { DEFAULT_ROOT };
