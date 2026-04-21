import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { projectHash, expandTilde, buildPath } from '../../lib/worktree.js';

describe('projectHash', () => {
  it('returns consistent 12-char sha256 prefix', () => {
    const h1 = projectHash('/Users/alice/my-project');
    const h2 = projectHash('/Users/alice/my-project');
    assert.equal(h1, h2);
    assert.equal(h1.length, 12);
    assert.match(h1, /^[a-f0-9]+$/);
  });

  it('differs across projects', () => {
    const h1 = projectHash('/a/b/c');
    const h2 = projectHash('/a/b/d');
    assert.notEqual(h1, h2);
  });
});

describe('expandTilde', () => {
  it('expands ~ to homedir', () => {
    const r = expandTilde('~/foo');
    assert.ok(r.endsWith('/foo'));
    assert.ok(!r.startsWith('~'));
  });

  it('leaves absolute paths untouched', () => {
    assert.equal(expandTilde('/abs/path'), '/abs/path');
  });

  it('returns null for null input', () => {
    assert.equal(expandTilde(null), null);
  });
});

describe('buildPath', () => {
  it('builds a path with all segments', () => {
    const { path, timestamp } = buildPath({
      root: '/tmp/pf',
      projectRoot: '/abs/project',
      namespace: 'fix',
      name: '123',
      timestamp: 1700000000,
    });
    assert.ok(path.includes('/tmp/pf/'));
    assert.ok(path.includes('/fix/123/'));
    assert.ok(path.endsWith('/1700000000'));
    assert.equal(timestamp, 1700000000);
  });

  it('auto-generates timestamp when omitted', () => {
    const { timestamp } = buildPath({
      root: '/tmp',
      projectRoot: '/abs',
      namespace: 'feat',
      name: '1',
    });
    assert.ok(typeof timestamp === 'number' && timestamp > 0);
  });
});
