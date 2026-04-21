import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'polyforge-tl-'));
const originalHome = process.env.HOME;

describe('test-lock (isolated HOME)', () => {
  let acquireTestLock, releaseTestLock, readLock;

  before(async () => {
    process.env.HOME = tmp;
    const mod = await import(`../../lib/test-lock.js?t=${Date.now()}`);
    ({ acquireTestLock, releaseTestLock, readLock } = mod);
  });

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
    process.env.HOME = originalHome;
  });

  it('acquires and releases the lock', async () => {
    const result = await acquireTestLock({ owner: 'test-1', timeoutMs: 1000 });
    assert.equal(result.acquired, true);
    const held = readLock();
    assert.equal(held.owner, 'test-1');
    const released = releaseTestLock();
    assert.equal(released, true);
  });

  it('second acquire times out while first holds', async () => {
    const first = await acquireTestLock({ owner: 'holder', timeoutMs: 500 });
    assert.equal(first.acquired, true);
    const second = await acquireTestLock({ owner: 'waiter', timeoutMs: 600, pollMs: 100 });
    assert.equal(second.acquired, false);
    assert.equal(second.heldBy.owner, 'holder');
    releaseTestLock();
  });

  it('reclaims stale lock when holder PID is dead', async () => {
    const { writeFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const LOCK_PATH = resolve(tmp, '.polyforge', 'ci-mirror.lock');
    // Stale lock from dead PID 99999999
    writeFileSync(LOCK_PATH, JSON.stringify({ pid: 99999999, owner: 'ghost', acquiredAt: '2020-01-01' }));
    const result = await acquireTestLock({ owner: 'reclaim', timeoutMs: 2000 });
    assert.equal(result.acquired, true);
    releaseTestLock();
  });
});
