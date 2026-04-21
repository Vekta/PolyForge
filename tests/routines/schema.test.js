import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateRoutinesConfig, isValidCron } from '../../lib/routines/schema.js';

const minimalValid = {
  profile: 'standard',
  detected_plan: 'team',
  window: { start: '23:00', end: '07:00' },
  budget: { max_budget_usd_per_run: 1.5 },
  isolation: { strategy: 'worktree', base_branch: 'main' },
  routines: [
    {
      name: 'deps-security',
      enabled: true,
      schedule: '0 0 * * *',
      template: 'builtin:deps-security',
      autonomy: 'mixed',
      model: 'haiku',
      max_turns: 15,
      system_prompt_strategy: 'minimal',
      allowed_tools: ['Bash(npm *)', 'Bash(git *)'],
    },
  ],
};

describe('validateRoutinesConfig', () => {
  it('accepts a minimal valid config', () => {
    const { valid, errors } = validateRoutinesConfig(minimalValid);
    assert.equal(valid, true, errors.join('; '));
  });

  it('rejects invalid profile', () => {
    const cfg = { ...minimalValid, profile: 'totally-made-up' };
    const { valid, errors } = validateRoutinesConfig(cfg);
    assert.equal(valid, false);
    assert.ok(errors.some(e => e.includes('profile')));
  });

  it('rejects malformed window', () => {
    const cfg = { ...minimalValid, window: { start: '23:00' } };
    const { valid } = validateRoutinesConfig(cfg);
    assert.equal(valid, false);
  });

  it('rejects routine with non-kebab-case name', () => {
    const cfg = JSON.parse(JSON.stringify(minimalValid));
    cfg.routines[0].name = 'Bad_Name';
    const { valid, errors } = validateRoutinesConfig(cfg);
    assert.equal(valid, false);
    assert.ok(errors.some(e => e.includes('kebab-case')));
  });

  it('rejects routine with empty allowed_tools', () => {
    const cfg = JSON.parse(JSON.stringify(minimalValid));
    cfg.routines[0].allowed_tools = [];
    const { valid, errors } = validateRoutinesConfig(cfg);
    assert.equal(valid, false);
    assert.ok(errors.some(e => e.includes('allowed_tools')));
  });

  it('rejects unknown system_prompt_strategy', () => {
    const cfg = JSON.parse(JSON.stringify(minimalValid));
    cfg.routines[0].system_prompt_strategy = 'exhaustive';
    const { valid, errors } = validateRoutinesConfig(cfg);
    assert.equal(valid, false);
    assert.ok(errors.some(e => e.includes('system_prompt_strategy')));
  });

  it('rejects empty routines array', () => {
    const cfg = { ...minimalValid, routines: [] };
    const { valid } = validateRoutinesConfig(cfg);
    assert.equal(valid, false);
  });

  it('rejects non-positive max_budget', () => {
    const cfg = { ...minimalValid, budget: { max_budget_usd_per_run: 0 } };
    const { valid } = validateRoutinesConfig(cfg);
    assert.equal(valid, false);
  });

  it('rejects duplicate routine names', () => {
    const cfg = JSON.parse(JSON.stringify(minimalValid));
    cfg.routines.push({ ...cfg.routines[0] });
    const { valid, errors } = validateRoutinesConfig(cfg);
    assert.equal(valid, false);
    assert.ok(errors.some(e => e.includes('duplicate')));
  });

  it('rejects invalid cron in schedule', () => {
    const cfg = JSON.parse(JSON.stringify(minimalValid));
    cfg.routines[0].schedule = 'not a cron';
    const { valid, errors } = validateRoutinesConfig(cfg);
    assert.equal(valid, false);
    assert.ok(errors.some(e => e.includes('schedule')));
  });

  it('requires auto_merge_allowlist when autonomy=auto-merge', () => {
    const cfg = JSON.parse(JSON.stringify(minimalValid));
    cfg.routines[0].autonomy = 'auto-merge';
    const { valid, errors } = validateRoutinesConfig(cfg);
    assert.equal(valid, false);
    assert.ok(errors.some(e => e.includes('auto_merge_allowlist')));
  });

  it('accepts auto-merge when allowlist is non-empty', () => {
    const cfg = JSON.parse(JSON.stringify(minimalValid));
    cfg.routines[0].autonomy = 'auto-merge';
    cfg.routines[0].auto_merge_allowlist = ['patch-version-bump'];
    const { valid, errors } = validateRoutinesConfig(cfg);
    assert.equal(valid, true, errors.join('; '));
  });
});

describe('isValidCron', () => {
  it('accepts "0 23 * * *"', () => {
    assert.equal(isValidCron('0 23 * * *'), true);
  });

  it('accepts comma-separated numbers', () => {
    assert.equal(isValidCron('0,15,30 * * * *'), true);
  });

  it('rejects 4-field cron', () => {
    assert.equal(isValidCron('0 23 * *'), false);
  });

  it('rejects non-string input', () => {
    assert.equal(isValidCron(null), false);
    assert.equal(isValidCron(undefined), false);
    assert.equal(isValidCron(42), false);
  });

  it('rejects ranges (unsupported)', () => {
    assert.equal(isValidCron('0-30 * * * *'), false);
  });
});
