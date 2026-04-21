import { addWorktree, buildPath, expandTilde, DEFAULT_ROOT } from './worktree.js';
import { syncIfNeeded } from './ci-mirror-sync.js';
import { acquireTestLock, releaseTestLock } from './test-lock.js';

export function parseTicketList(args) {
  const tickets = [];
  for (const a of args) {
    const ghMatch = a.match(/^#(\d+)$/);
    if (ghMatch) {
      tickets.push({ type: 'github', number: Number(ghMatch[1]), ref: a });
      continue;
    }
    const jiraMatch = a.match(/^([A-Z][A-Z0-9]+)-(\d+)$/);
    if (jiraMatch) {
      tickets.push({ type: 'jira', key: a, number: Number(jiraMatch[2]), ref: a });
      continue;
    }
  }
  return tickets;
}

export async function planExecution({ projectRoot, config, tickets, kind = 'fix' }) {
  const namespace = kind;
  const baseBranch = config.isolation?.base_branch || config.git?.defaultBranch || 'main';
  const baseRef = config.isolation?.base_ref || `origin/${baseBranch}`;
  const worktreeRoot = expandTilde(config.isolation?.worktree_root) || DEFAULT_ROOT;
  const maxConcurrent = Math.max(1, Math.min(
    config.parallelism?.maxConcurrent || 1,
    tickets.length
  ));

  // Single sync at orchestrator level — agents inherit the updated config
  const syncResult = syncIfNeeded(projectRoot, { defaultBranch: baseBranch });

  const plan = tickets.map(t => {
    const ticketId = t.type === 'jira' ? t.key : `${t.number}`;
    const branchName = `${ticketId}`;
    const { path, timestamp } = buildPath({
      root: worktreeRoot,
      projectRoot,
      namespace,
      name: branchName,
      timestamp: undefined,
    });
    return {
      ticket: t,
      branchName,
      branchPrefix: namespace,
      worktreePath: path,
      timestamp,
      baseBranch,
      baseRef,
    };
  });

  return {
    maxConcurrent,
    parallelism: config.parallelism?.mode || 'serialized',
    sync: syncResult,
    plan,
  };
}

export function createWorktreesForPlan({ projectRoot, plan }) {
  const results = [];
  // Single fetch covers all worktrees
  for (const item of plan) {
    try {
      const wt = addWorktree({
        projectRoot,
        baseBranch: item.baseBranch,
        baseRef: item.baseRef,
        branchPrefix: item.branchPrefix,
        branchName: item.branchName,
        path: item.worktreePath,
        fetchFirst: results.length === 0,
      });
      results.push({ ...item, worktree: wt, ok: true });
    } catch (e) {
      results.push({ ...item, ok: false, error: e.message });
    }
  }
  return results;
}

export { acquireTestLock, releaseTestLock };
