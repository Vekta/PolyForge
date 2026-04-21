import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePolyforgeConfig } from '../../lib/config/schema.js';

describe('validatePolyforgeConfig', () => {
  it('accepts empty config', () => {
    const { valid } = validatePolyforgeConfig({});
    assert.equal(valid, true);
  });

  it('accepts a fully populated valid config', () => {
    const cfg = {
      schemaVersion: '1.1.0',
      git: { defaultBranch: 'main' },
      issueTracker: {
        type: 'jira',
        transitions: {
          onStart: { status: 'In Progress' },
          onPrReady: { status: 'Code Review' },
          onBlocked: { status: 'Blocked' },
          onReject: { status: 'Won\'t Do' },
        },
      },
      pipeline: {
        ciMirror: {
          commands: [{ cmd: 'npm test', blocking: true }],
          excludePatterns: ['^deploy', '^release'],
          learningConsent: 'granted',
        },
      },
      parallelism: {
        mode: 'serialized',
        maxConcurrent: 2,
      },
    };
    const { valid, errors } = validatePolyforgeConfig(cfg);
    assert.equal(valid, true, errors.join('; '));
  });

  it('rejects unknown transition name', () => {
    const cfg = {
      issueTracker: {
        transitions: {
          onStart: { status: 'In Progress' },
          onWhatever: { status: 'Something' },
        },
      },
    };
    const { valid, errors } = validatePolyforgeConfig(cfg);
    assert.equal(valid, false);
    assert.ok(errors.some(e => e.includes('onWhatever')));
  });

  it('rejects transition missing status', () => {
    const cfg = { issueTracker: { transitions: { onStart: {} } } };
    const { valid, errors } = validatePolyforgeConfig(cfg);
    assert.equal(valid, false);
    assert.ok(errors.some(e => e.includes('status')));
  });

  it('rejects invalid regex in excludePatterns', () => {
    const cfg = { pipeline: { ciMirror: { commands: [], excludePatterns: ['[invalid'] } } };
    const { valid, errors } = validatePolyforgeConfig(cfg);
    assert.equal(valid, false);
    assert.ok(errors.some(e => e.includes('invalid regex')));
  });

  it('rejects unknown learningConsent value', () => {
    const cfg = { pipeline: { ciMirror: { commands: [], learningConsent: 'maybe' } } };
    const { valid } = validatePolyforgeConfig(cfg);
    assert.equal(valid, false);
  });

  it('rejects unknown parallelism mode', () => {
    const cfg = { parallelism: { mode: 'aggressive' } };
    const { valid } = validatePolyforgeConfig(cfg);
    assert.equal(valid, false);
  });

  it('rejects non-positive maxConcurrent', () => {
    const cfg = { parallelism: { maxConcurrent: 0 } };
    const { valid } = validatePolyforgeConfig(cfg);
    assert.equal(valid, false);
  });
});
