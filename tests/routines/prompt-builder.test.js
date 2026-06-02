import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'polyforge-prompt-'));
const originalHome = process.env.HOME;

describe('buildSystemPrompt (isolated HOME)', () => {
  let buildSystemPrompt, SHARED_PREFIX;

  before(async () => {
    process.env.HOME = tmp;
    const mod = await import(`../../lib/routines/prompt-builder.js?t=${Date.now()}`);
    ({ buildSystemPrompt, SHARED_PREFIX } = mod);
  });

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
    process.env.HOME = originalHome;
  });

  it('starts every minimal prompt with the shared prefix', () => {
    const a = buildSystemPrompt(tmp, { name: 'a', system_prompt_strategy: 'minimal', template: 'builtin:a', max_turns: 5, autonomy: 'suggest' });
    const b = buildSystemPrompt(tmp, { name: 'b', system_prompt_strategy: 'minimal', template: 'builtin:b', max_turns: 5, autonomy: 'suggest' });
    const textA = readFileSync(a.file, 'utf-8');
    const textB = readFileSync(b.file, 'utf-8');
    assert.ok(textA.startsWith(SHARED_PREFIX));
    assert.ok(textB.startsWith(SHARED_PREFIX));
  });

  it('shares an identical cacheable prefix across different routines', () => {
    const a = buildSystemPrompt(tmp, { name: 'x', system_prompt_strategy: 'targeted', system_prompt_sources: [] });
    const b = buildSystemPrompt(tmp, { name: 'y', system_prompt_strategy: 'targeted', system_prompt_sources: [] });
    const prefixA = readFileSync(a.file, 'utf-8').slice(0, SHARED_PREFIX.length);
    const prefixB = readFileSync(b.file, 'utf-8').slice(0, SHARED_PREFIX.length);
    assert.equal(prefixA, prefixB);
  });

  it('contains no timestamp or date that would bust the cache', () => {
    const r = buildSystemPrompt(tmp, { name: 'z', system_prompt_strategy: 'minimal', template: 'builtin:z', max_turns: 5, autonomy: 'suggest' });
    const text = readFileSync(r.file, 'utf-8');
    assert.ok(!/\d{4}-\d{2}-\d{2}/.test(text), 'no ISO date');
    assert.ok(!/\d{2}:\d{2}:\d{2}/.test(text), 'no clock time');
  });
});
