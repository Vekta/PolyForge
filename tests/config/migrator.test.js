import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectNeededMigrations, applyMigrations, computeDiff, DEAD_PIPELINE_FIELDS } from '../../lib/config/migrator.js';
import { CONFIG_VERSION } from '../../lib/config/schema.js';

describe('detectNeededMigrations', () => {
  it('returns empty when already at current version', () => {
    const cfg = { schemaVersion: CONFIG_VERSION };
    assert.deepEqual(detectNeededMigrations(cfg), []);
  });

  it('detects dead pipeline fields when schemaVersion absent', () => {
    const cfg = { pipeline: { preCommit: ['test'], prePush: ['lint'], ciMirror: {} } };
    const migrations = detectNeededMigrations(cfg);
    const dead = migrations.find(m => m.id === 'remove-dead-pipeline-fields');
    assert.ok(dead);
    assert.deepEqual(dead.fields.sort(), ['preCommit', 'prePush'].sort());
  });

  it('always stamps schemaVersion when missing', () => {
    const cfg = {};
    const migrations = detectNeededMigrations(cfg);
    assert.ok(migrations.some(m => m.id === 'set-schema-version'));
  });

  it('does not flag dead fields if none present', () => {
    const cfg = { pipeline: { ciMirror: {} } };
    const migrations = detectNeededMigrations(cfg);
    assert.ok(!migrations.some(m => m.id === 'remove-dead-pipeline-fields'));
  });
});

describe('applyMigrations', () => {
  it('removes dead fields and stamps version', () => {
    const cfg = { pipeline: { preCommit: ['test'], ciMirror: {} } };
    const migrations = detectNeededMigrations(cfg);
    const next = applyMigrations(cfg, migrations);
    assert.equal('preCommit' in next.pipeline, false);
    assert.equal(next.schemaVersion, CONFIG_VERSION);
    assert.ok(next.pipeline.ciMirror);
  });

  it('drops empty pipeline object if all fields removed', () => {
    const cfg = { pipeline: { preCommit: ['test'], prePush: ['lint'], prePR: ['test'] } };
    const migrations = detectNeededMigrations(cfg);
    const next = applyMigrations(cfg, migrations);
    assert.equal('pipeline' in next, false);
  });

  it('does not mutate the input', () => {
    const cfg = { pipeline: { preCommit: ['test'] } };
    const orig = JSON.stringify(cfg);
    const migrations = detectNeededMigrations(cfg);
    applyMigrations(cfg, migrations);
    assert.equal(JSON.stringify(cfg), orig);
  });
});

describe('computeDiff', () => {
  it('reports unchanged when objects are identical', () => {
    const a = { foo: 'bar' };
    const b = { foo: 'bar' };
    assert.equal(computeDiff(a, b).changed, false);
  });

  it('reports changed when objects differ', () => {
    const a = { foo: 'bar' };
    const b = { foo: 'baz' };
    const { changed, diff } = computeDiff(a, b);
    assert.equal(changed, true);
    assert.ok(diff.includes('- ') && diff.includes('+ '));
  });
});

describe('DEAD_PIPELINE_FIELDS', () => {
  it('covers the three legacy fields', () => {
    assert.deepEqual(DEAD_PIPELINE_FIELDS.sort(), ['preCommit', 'prePR', 'prePush'].sort());
  });
});
