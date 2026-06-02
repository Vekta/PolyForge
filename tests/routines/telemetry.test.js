import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'polyforge-telemetry-'));
const originalHome = process.env.HOME;

describe('telemetry (isolated HOME)', () => {
  let recordUsage, summary, detectCostRegression, routineAverageCost;

  before(async () => {
    process.env.HOME = tmp;
    const mod = await import(`../../lib/routines/telemetry.js?t=${Date.now()}`);
    ({ recordUsage, summary, detectCostRegression, routineAverageCost } = mod);
  });

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
    process.env.HOME = originalHome;
  });

  it('records and summarizes a single run', () => {
    recordUsage({
      routine: 'deps-security',
      inputTokens: 5000,
      outputTokens: 1000,
      costUsd: 0.02,
      model: 'haiku',
    });
    const s = summary(300);
    assert.equal(s.runs, 1);
    assert.equal(s.totalIn, 5000);
    assert.equal(s.totalOut, 1000);
    assert.ok(s.byRoutine['deps-security']);
    assert.equal(s.byRoutine['deps-security'].runs, 1);
  });

  it('persists to a JSON file under $HOME', () => {
    const path = join(tmp, '.polyforge', 'token-window.json');
    assert.equal(existsSync(path), true);
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    assert.ok(Array.isArray(data.entries));
  });

  it('aggregates cache tokens and computes a hit rate', () => {
    recordUsage({
      routine: 'cache-test',
      inputTokens: 0,
      outputTokens: 100,
      cacheReadTokens: 9000,
      cacheCreationTokens: 1000,
      costUsd: 0.01,
      model: 'haiku',
    });
    const s = summary(300);
    assert.equal(s.totalCacheRead >= 9000, true);
    const r = s.byRoutine['cache-test'];
    assert.equal(r.cacheReadTokens, 9000);
    assert.equal(r.cacheCreationTokens, 1000);
    assert.equal(r.cacheHitRate, 0.9);
  });

  it('reports zero hit rate when there is no cache activity', () => {
    const s = summary(300);
    assert.equal(s.byRoutine['deps-security'].cacheHitRate, 0);
  });

  it('does not flag a regression without enough baseline samples', () => {
    recordUsage({ routine: 'regress-test', costUsd: 0.10, model: 'sonnet' });
    const result = detectCostRegression('regress-test', 0.50);
    assert.equal(result.regressed, false);
  });

  it('flags a cost regression past the 1.5x threshold', () => {
    recordUsage({ routine: 'regress-test', costUsd: 0.10, model: 'sonnet' });
    recordUsage({ routine: 'regress-test', costUsd: 0.10, model: 'sonnet' });
    const avg = routineAverageCost('regress-test');
    assert.ok(avg.runs >= 3);
    const result = detectCostRegression('regress-test', 0.50);
    assert.equal(result.regressed, true);
    assert.ok(result.ratio >= 1.5);
  });
});
