import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectFallbackCommands } from '../../lib/fallback-verbs.js';

describe('detectFallbackCommands', () => {
  function withProject(files, fn) {
    const root = mkdtempSync(join(tmpdir(), 'polyforge-fb-'));
    try {
      for (const [name, content] of Object.entries(files)) {
        writeFileSync(join(root, name), content);
      }
      return fn(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('returns empty for bare dir', () => {
    withProject({}, root => {
      const r = detectFallbackCommands(root);
      assert.deepEqual(r.commands, []);
      assert.deepEqual(r.detected, []);
    });
  });

  it('detects npm from package.json', () => {
    withProject({ 'package.json': '{"name":"a"}' }, root => {
      const r = detectFallbackCommands(root);
      assert.ok(r.detected.includes('package.json'));
      assert.ok(r.commands.some(c => c.cmd === 'npm test'));
    });
  });

  it('detects Go from go.mod with test + vet', () => {
    withProject({ 'go.mod': 'module example.com' }, root => {
      const r = detectFallbackCommands(root);
      assert.ok(r.commands.some(c => c.cmd === 'go test ./...'));
      assert.ok(r.commands.some(c => c.cmd === 'go vet ./...'));
    });
  });

  it('combines multi-stack projects', () => {
    withProject({
      'package.json': '{"name":"a"}',
      'Cargo.toml': '[package]\nname="x"',
    }, root => {
      const r = detectFallbackCommands(root);
      assert.ok(r.detected.includes('package.json'));
      assert.ok(r.detected.includes('Cargo.toml'));
      assert.ok(r.commands.some(c => c.cmd.startsWith('npm')));
      assert.ok(r.commands.some(c => c.cmd.startsWith('cargo')));
    });
  });
});
