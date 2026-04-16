import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'polyforge-telemetry-'));
const originalHome = process.env.HOME;

describe('telemetry (isolated HOME)', () => {
  let recordUsage, summary;

  before(async () => {
    process.env.HOME = tmp;
    const mod = await import(`../../lib/routines/telemetry.js?t=${Date.now()}`);
    ({ recordUsage, summary } = mod);
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
});
