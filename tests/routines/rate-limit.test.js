import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'polyforge-rl-'));
const originalHome = process.env.HOME;

describe('rate-limit (isolated HOME)', () => {
  let setRateLimited, isRateLimited, rateLimitFromClaudeError;

  before(async () => {
    process.env.HOME = tmp;
    const mod = await import(`../../lib/routines/rate-limit.js?t=${Date.now()}`);
    ({ setRateLimited, isRateLimited, rateLimitFromClaudeError } = mod);
  });

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
    process.env.HOME = originalHome;
  });

  it('reports not limited when no marker', () => {
    assert.equal(isRateLimited().limited, false);
  });

  it('sets and reads marker', () => {
    setRateLimited(Date.now() + 60000, 'test');
    const r = isRateLimited();
    assert.equal(r.limited, true);
    assert.equal(r.reason, 'test');
  });

  it('auto-clears expired marker', () => {
    setRateLimited(Date.now() - 1000, 'old');
    assert.equal(isRateLimited().limited, false);
  });

  it('detects rate-limit from claude -p JSON result', () => {
    const jsonResult = {
      subtype: 'error',
      is_error: true,
      api_error_status: 'rate_limit_exceeded',
      errors: ['Rate limit exceeded'],
    };
    const triggered = rateLimitFromClaudeError(jsonResult, 10);
    assert.equal(triggered, true);
    assert.equal(isRateLimited().limited, true);
  });

  it('ignores non-rate-limit errors', () => {
    setRateLimited(Date.now() - 1000, 'cleared');
    const jsonResult = { is_error: true, api_error_status: 'server_error', errors: ['boom'] };
    const triggered = rateLimitFromClaudeError(jsonResult);
    assert.equal(triggered, false);
  });
});
