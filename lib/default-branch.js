import { execFileSync } from 'node:child_process';

export function resolveDefaultBranch(projectRoot) {
  const fromGh = tryGh(projectRoot);
  if (fromGh) return { branch: fromGh, source: 'gh' };

  const fromGit = tryGitSymbolicRef(projectRoot);
  if (fromGit) return { branch: fromGit, source: 'git-symbolic-ref' };

  return { branch: 'main', source: 'fallback-default', warning: 'Could not resolve default branch, falling back to "main"' };
}

function tryGh(projectRoot) {
  try {
    const out = execFileSync('gh', ['repo', 'view', '--json', 'defaultBranchRef'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(out);
    return parsed?.defaultBranchRef?.name || null;
  } catch {
    return null;
  }
}

function tryGitSymbolicRef(projectRoot) {
  try {
    const out = execFileSync('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out.trim().replace(/^origin\//, '');
  } catch {
    return null;
  }
}
