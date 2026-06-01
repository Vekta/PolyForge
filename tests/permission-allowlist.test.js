import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recommendedAllowlist, mergeIntoSettings } from '../lib/permission-allowlist.js';

describe('recommendedAllowlist', () => {
  it('always includes the worktree filesystem patterns', () => {
    const allow = recommendedAllowlist({});
    for (const p of ['Bash(ln:*)', 'Bash(rm:*)', 'Bash(mkdir:*)', 'Bash(touch:*)']) {
      assert.ok(allow.includes(p), `expected ${p}`);
    }
  });

  it('adds composer + php patterns for a PHP stack', () => {
    const allow = recommendedAllowlist({ stack: ['php'], packageManager: 'composer' });
    assert.ok(allow.includes('Bash(composer:*)'));
    assert.ok(allow.includes('Bash(php:*)'));
  });

  it('adds pnpm patterns when the package manager is pnpm', () => {
    const allow = recommendedAllowlist({ stack: ['typescript'], packageManager: 'pnpm' });
    assert.ok(allow.includes('Bash(pnpm:*)'));
    assert.ok(allow.includes('Bash(npx:*)'));
  });

  it('adds docker patterns when a container is detected', () => {
    const allow = recommendedAllowlist({ stack: ['php'], database: { containerName: 'app-db' } });
    assert.ok(allow.includes('Bash(docker:*)'));
    assert.ok(allow.includes('Bash(docker-compose:*)'));
  });

  it('omits docker patterns when no container is present', () => {
    const allow = recommendedAllowlist({ stack: ['go'] });
    assert.ok(!allow.includes('Bash(docker:*)'));
  });

  it('is case-insensitive on stack and package manager', () => {
    const allow = recommendedAllowlist({ stack: ['Go'], packageManager: 'NPM' });
    assert.ok(allow.includes('Bash(go:*)'));
    assert.ok(allow.includes('Bash(npm:*)'));
  });

  it('returns a deduplicated, sorted list', () => {
    const allow = recommendedAllowlist({ stack: ['javascript'], packageManager: 'npm' });
    assert.deepEqual(allow, [...new Set(allow)].sort());
  });

  it('ignores unknown stacks gracefully', () => {
    const allow = recommendedAllowlist({ stack: ['cobol'], packageManager: 'make' });
    assert.deepEqual(allow, [...new Set(['Bash(ln:*)', 'Bash(rm:*)', 'Bash(mkdir:*)', 'Bash(touch:*)'])].sort());
  });
});

describe('mergeIntoSettings', () => {
  it('creates permissions.allow when settings are empty', () => {
    const result = mergeIntoSettings({}, ['Bash(npm:*)']);
    assert.deepEqual(result.permissions.allow, ['Bash(npm:*)']);
  });

  it('appends without duplicating existing entries', () => {
    const existing = { permissions: { allow: ['Bash(npm:*)', 'Bash(git:*)'] } };
    const result = mergeIntoSettings(existing, ['Bash(npm:*)', 'Bash(ln:*)']);
    assert.deepEqual(result.permissions.allow, ['Bash(npm:*)', 'Bash(git:*)', 'Bash(ln:*)']);
  });

  it('preserves unrelated settings keys', () => {
    const existing = { model: 'opus', permissions: { deny: ['Bash(curl:*)'], allow: [] } };
    const result = mergeIntoSettings(existing, ['Bash(rm:*)']);
    assert.equal(result.model, 'opus');
    assert.deepEqual(result.permissions.deny, ['Bash(curl:*)']);
    assert.deepEqual(result.permissions.allow, ['Bash(rm:*)']);
  });

  it('does not mutate the input object', () => {
    const existing = { permissions: { allow: ['Bash(git:*)'] } };
    const snapshot = JSON.stringify(existing);
    mergeIntoSettings(existing, ['Bash(rm:*)']);
    assert.equal(JSON.stringify(existing), snapshot);
  });

  it('tolerates a non-array allow field', () => {
    const result = mergeIntoSettings({ permissions: { allow: 'oops' } }, ['Bash(rm:*)']);
    assert.deepEqual(result.permissions.allow, ['Bash(rm:*)']);
  });
});
