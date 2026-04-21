import { execFileSync } from 'node:child_process';
import { listRoutineWorktrees, removeWorktree } from './worktree.js';
import { logEvent } from './logger.js';

const WARN_THRESHOLD = 10;

export function cleanupStaleWorktrees(projectRoot, config) {
  const wts = listRoutineWorktrees(projectRoot);
  const results = { scanned: wts.length, removed: [], kept: [], errors: [] };

  for (const wt of wts) {
    const prInfo = prForBranch(projectRoot, wt.branch);
    if (!prInfo) {
      results.kept.push({ ...wt, reason: 'no PR yet' });
      continue;
    }
    if (prInfo.state === 'OPEN') {
      results.kept.push({ ...wt, reason: `PR #${prInfo.number} open` });
      continue;
    }
    const closedAt = new Date(prInfo.closedAt || prInfo.mergedAt || 0).getTime();
    const ageDays = (Date.now() - closedAt) / (1000 * 60 * 60 * 24);
    const threshold = config.isolation.cleanup_on_pr_closed_after_days || 3;
    if (ageDays < threshold) {
      results.kept.push({ ...wt, reason: `PR closed ${ageDays.toFixed(1)}d ago, < ${threshold}d` });
      continue;
    }
    try {
      removeWorktree(projectRoot, wt.path);
      execFileSync('git', ['branch', '-D', wt.branch], { cwd: projectRoot, stdio: 'pipe' });
      results.removed.push({ ...wt, prState: prInfo.state, ageDays });
    } catch (e) {
      results.errors.push({ ...wt, error: e.message });
    }
  }

  if (results.kept.length >= WARN_THRESHOLD) {
    logEvent('_cleanup', { type: 'warn', msg: `${results.kept.length} routine worktrees kept (threshold ${WARN_THRESHOLD})` });
  }
  logEvent('_cleanup', { type: 'run', ...results });
  return results;
}

function prForBranch(projectRoot, branch) {
  try {
    const out = execFileSync('gh', ['pr', 'list', '--head', branch, '--state', 'all', '--limit', '1', '--json', 'number,state,closedAt,mergedAt'], {
      cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    const arr = JSON.parse(out);
    return arr[0] || null;
  } catch {
    return null;
  }
}
