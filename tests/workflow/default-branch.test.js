import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveDefaultBranch } from '../../lib/default-branch.js';

describe('resolveDefaultBranch', () => {
  it('always returns a branch name (even for non-git dir)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'polyforge-db-'));
    const result = resolveDefaultBranch(tmp);
    assert.equal(typeof result.branch, 'string');
    assert.ok(result.branch.length > 0);
    assert.ok(['gh', 'git-symbolic-ref', 'fallback-default'].includes(result.source));
    rmSync(tmp, { recursive: true, force: true });
  });

  it('falls back to "main" when not a git repo', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'polyforge-db-'));
    const result = resolveDefaultBranch(tmp);
    assert.equal(result.branch, 'main');
    assert.equal(result.source, 'fallback-default');
    rmSync(tmp, { recursive: true, force: true });
  });
});
