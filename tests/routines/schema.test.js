import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateRoutinesConfig } from '../../lib/routines/schema.js';

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
});
