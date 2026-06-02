import { execFileSync } from 'node:child_process';

export const VALID_PREDICATE_TYPES = [
  'always',
  'untriaged-issues',
  'open-issues',
  'open-prs',
  'commits-since-tag',
  'recent-commits',
];

function defaultExec(projectRoot) {
  return (file, args) => execFileSync(file, args, {
    cwd: projectRoot || process.cwd(),
    encoding: 'utf-8',
    timeout: 15000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function result(hasWork, reason) {
  return { hasWork, reason };
}

export function evaluateWorkPredicate(spec, ctx = {}) {
  if (!spec || !spec.type || spec.type === 'always') {
    return result(true, 'always');
  }
  const exec = ctx.exec || defaultExec(ctx.projectRoot);

  try {
    switch (spec.type) {
      case 'untriaged-issues': {
        const arr = JSON.parse(exec('gh', ['issue', 'list', '--search', 'no:label', '--state', 'open', '--limit', '1', '--json', 'number']) || '[]');
        return result(arr.length > 0, `${arr.length} untriaged issue(s)`);
      }
      case 'open-issues': {
        const arr = JSON.parse(exec('gh', ['issue', 'list', '--state', 'open', '--limit', '1', '--json', 'number']) || '[]');
        return result(arr.length > 0, `${arr.length} open issue(s)`);
      }
      case 'open-prs': {
        const arr = JSON.parse(exec('gh', ['pr', 'list', '--state', 'open', '--limit', '1', '--json', 'number']) || '[]');
        return result(arr.length > 0, `${arr.length} open PR(s)`);
      }
      case 'commits-since-tag': {
        let tag;
        try {
          tag = exec('git', ['describe', '--tags', '--abbrev=0']).trim();
        } catch {
          return result(true, 'no tags yet');
        }
        const count = Number(exec('git', ['rev-list', `${tag}..HEAD`, '--count']).trim());
        return result(count > 0, `${count} commit(s) since ${tag}`);
      }
      case 'recent-commits': {
        const hours = spec.withinHours || 24;
        const out = exec('git', ['log', `--since=${hours} hours ago`, '--oneline']).trim();
        const count = out ? out.split('\n').length : 0;
        return result(count > 0, `${count} commit(s) in last ${hours}h`);
      }
      default:
        return result(true, `unknown predicate "${spec.type}" — running`);
    }
  } catch (e) {
    return result(true, `predicate error (${e.message}) — running`);
  }
}
