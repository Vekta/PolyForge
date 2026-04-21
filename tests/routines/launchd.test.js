import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cronToCalendarInterval } from '../../lib/routines/launchd.js';

describe('cronToCalendarInterval', () => {
  it('translates "0 23 * * *" → {Hour:23, Minute:0}', () => {
    const r = cronToCalendarInterval('0 23 * * *');
    assert.deepEqual(r, { Minute: 0, Hour: 23 });
  });

  it('translates "15 7 * * *" → {Hour:7, Minute:15}', () => {
    const r = cronToCalendarInterval('15 7 * * *');
    assert.deepEqual(r, { Minute: 15, Hour: 7 });
  });

  it('translates "0 4 * * 0" → Sunday at 04:00', () => {
    const r = cronToCalendarInterval('0 4 * * 0');
    assert.deepEqual(r, { Minute: 0, Hour: 4, Weekday: 0 });
  });

  it('throws on wildcards where we expect a value', () => {
    assert.throws(() => cronToCalendarInterval('* * * * *'));
  });

  it('throws on malformed cron', () => {
    assert.throws(() => cronToCalendarInterval('abc'));
  });

  it('throws on out-of-range values', () => {
    assert.throws(() => cronToCalendarInterval('0 25 * * *'));
  });
});
