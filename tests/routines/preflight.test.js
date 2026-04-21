import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinWindow } from '../../lib/routines/preflight.js';

describe('isWithinWindow', () => {
  it('returns true when now is in a same-day window', () => {
    const windowCfg = { start: '09:00', end: '17:00' };
    const now = new Date('2026-04-16T13:00:00');
    assert.equal(isWithinWindow(windowCfg, now), true);
  });

  it('returns false before start', () => {
    const windowCfg = { start: '09:00', end: '17:00' };
    const now = new Date('2026-04-16T08:59:00');
    assert.equal(isWithinWindow(windowCfg, now), false);
  });

  it('returns false at exact end (exclusive)', () => {
    const windowCfg = { start: '09:00', end: '17:00' };
    const now = new Date('2026-04-16T17:00:00');
    assert.equal(isWithinWindow(windowCfg, now), false);
  });

  it('handles crossing-midnight window (23:00 -> 07:00) late night', () => {
    const windowCfg = { start: '23:00', end: '07:00' };
    const now = new Date('2026-04-16T23:30:00');
    assert.equal(isWithinWindow(windowCfg, now), true);
  });

  it('handles crossing-midnight window early morning', () => {
    const windowCfg = { start: '23:00', end: '07:00' };
    const now = new Date('2026-04-16T02:00:00');
    assert.equal(isWithinWindow(windowCfg, now), true);
  });

  it('rejects midday when window is nocturnal', () => {
    const windowCfg = { start: '23:00', end: '07:00' };
    const now = new Date('2026-04-16T12:00:00');
    assert.equal(isWithinWindow(windowCfg, now), false);
  });
});
