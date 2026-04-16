import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

function markerPath() {
  const dir = resolve(homedir(), '.polyforge');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return resolve(dir, 'rate-limited-until.json');
}

export function setRateLimited(untilMs, reason) {
  writeFileSync(markerPath(), JSON.stringify({
    until: untilMs,
    reason: reason || 'rate_limit_exceeded',
    setAt: Date.now(),
  }, null, 2));
}

export function isRateLimited() {
  const p = markerPath();
  if (!existsSync(p)) return { limited: false };
  let data;
  try { data = JSON.parse(readFileSync(p, 'utf-8')); }
  catch { return { limited: false }; }
  if (Date.now() >= data.until) {
    unlinkSync(p);
    return { limited: false };
  }
  return { limited: true, until: data.until, reason: data.reason };
}

export function rateLimitFromClaudeError(jsonResult, defaultWindowMinutes = 300) {
  const status = jsonResult?.api_error_status;
  const errors = jsonResult?.errors || [];
  const isRate = status === 'rate_limit_exceeded' ||
    errors.some(e => /rate.?limit/i.test(e));
  if (!isRate) return false;
  setRateLimited(Date.now() + defaultWindowMinutes * 60 * 1000, status || 'rate_limit');
  return true;
}
