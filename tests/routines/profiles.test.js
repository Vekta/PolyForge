import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoutinesConfig, PROFILE_DEFAULTS, ROUTINE_DEFAULTS, resolveModel } from '../../lib/routines/profiles.js';
import { validateRoutinesConfig } from '../../lib/routines/schema.js';

const window = { start: '23:00', end: '07:00', stop_before: '06:45' };

describe('buildRoutinesConfig', () => {
  for (const profile of Object.keys(PROFILE_DEFAULTS)) {
    it(`produces a valid config for profile "${profile}"`, () => {
      const cfg = buildRoutinesConfig(profile, 'team', window);
      const { valid, errors } = validateRoutinesConfig(cfg);
      assert.equal(valid, true, `errors: ${errors.join('; ')}`);
      assert.equal(cfg.profile, profile);
    });
  }

  it('throws on unknown profile', () => {
    assert.throws(() => buildRoutinesConfig('exhaustive', 'team', window));
  });

  it('marks every routine first_run_dry=true by default', () => {
    const cfg = buildRoutinesConfig('unleashed', 'team', window);
    for (const r of cfg.routines) {
      assert.equal(r.first_run_dry, true, `${r.name} should be first_run_dry`);
    }
  });
});

describe('ROUTINE_DEFAULTS', () => {
  it('every routine has allowed_tools and system_prompt_strategy', () => {
    for (const [name, def] of Object.entries(ROUTINE_DEFAULTS)) {
      assert.ok(Array.isArray(def.allowed_tools) && def.allowed_tools.length > 0, `${name} allowed_tools`);
      assert.ok(['full', 'targeted', 'minimal'].includes(def.system_prompt_strategy), `${name} strategy`);
    }
  });

  it('issue-worker uses targeted strategy with scoped sources', () => {
    assert.equal(ROUTINE_DEFAULTS['issue-worker'].system_prompt_strategy, 'targeted');
    assert.ok(Array.isArray(ROUTINE_DEFAULTS['issue-worker'].system_prompt_sources));
  });

  it('deps-security uses minimal strategy', () => {
    assert.equal(ROUTINE_DEFAULTS['deps-security'].system_prompt_strategy, 'minimal');
  });
});

describe('model routing', () => {
  it('clamps a routine model to the profile ceiling', () => {
    assert.equal(resolveModel('opus', 'sonnet'), 'sonnet');
    assert.equal(resolveModel('sonnet', 'opus'), 'sonnet');
    assert.equal(resolveModel('haiku', 'haiku'), 'haiku');
  });

  it('keeps issue-worker on opus under an opus-ceiling profile', () => {
    const cfg = buildRoutinesConfig('full', 'team', window);
    const iw = cfg.routines.find(r => r.name === 'issue-worker');
    assert.equal(iw.model, 'opus');
  });

  it('clamps every routine to haiku under the light profile', () => {
    const cfg = buildRoutinesConfig('light', 'team', window);
    for (const r of cfg.routines) {
      assert.equal(r.model, 'haiku', `${r.name} should be clamped to haiku`);
    }
  });

  it('assigns a cache config with a 1h TTL', () => {
    const cfg = buildRoutinesConfig('standard', 'team', window);
    assert.equal(cfg.cache.ttl, '1h');
    assert.equal(cfg.cache.shared_prefix, true);
  });
});
