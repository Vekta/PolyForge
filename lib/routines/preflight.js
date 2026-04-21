import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { isRateLimited } from './rate-limit.js';
import { detectPlan } from './plan-detector.js';

function getFreeMb(path) {
  try {
    const out = execFileSync('df', ['-Pk', path], { encoding: 'utf-8', timeout: 3000 });
    const line = out.trim().split('\n').pop();
    const parts = line.trim().split(/\s+/);
    const availKb = Number(parts[3]);
    if (!Number.isFinite(availKb)) return null;
    return Math.floor(availKb / 1024);
  } catch {
    return null;
  }
}

const MIN_DISK_MB = 500;

export function preflight(projectRoot, config, routineName, opts = {}) {
  const checks = [];
  const fail = (code, msg) => ({ ok: false, code, msg });
  const pass = (code) => ({ ok: true, code });

  const pausePath = resolve(homedir(), '.polyforge', 'PAUSE');
  if (existsSync(pausePath)) {
    checks.push(fail('kill-switch', `~/.polyforge/PAUSE exists — all routines paused`));
    return { ok: false, checks };
  }
  checks.push(pass('kill-switch'));

  const plan = detectPlan();
  if (!plan.ok) {
    checks.push(fail('plan', `claude auth status: ${plan.reason}`));
    return { ok: false, checks };
  }
  checks.push(pass('plan'));

  if (!opts.skipWindow) {
    const inWindow = isWithinWindow(config.window, new Date());
    if (!inWindow) {
      checks.push(fail('window', `now outside ${config.window.start}-${config.window.end} (system TZ)`));
      return { ok: false, checks };
    }
    checks.push(pass('window'));
  }

  const rl = isRateLimited();
  if (rl.limited) {
    checks.push(fail('rate-limit', `rate-limited until ${new Date(rl.until).toISOString()}`));
    return { ok: false, checks };
  }
  checks.push(pass('rate-limit'));

  try {
    execFileSync('git', ['fetch', 'origin', config.isolation.base_branch], {
      cwd: projectRoot, stdio: 'pipe', timeout: 15000,
    });
    checks.push(pass('git-fetch'));
  } catch (e) {
    checks.push(fail('git-fetch', `git fetch failed: ${e.message}`));
    return { ok: false, checks };
  }

  try {
    // Node-level timeout is the authoritative bound; ping's own -W flag has
    // incompatible units (seconds on macOS/BSD, milliseconds on Linux). Let
    // the OS use its default and rely on our 3s timeout.
    execFileSync('ping', ['-c', '1', '1.1.1.1'], { stdio: 'pipe', timeout: 3000 });
    checks.push(pass('network'));
  } catch {
    checks.push(fail('network', 'no network'));
    return { ok: false, checks };
  }

  const freeMb = getFreeMb(homedir());
  if (freeMb === null) {
    checks.push({ ok: true, code: 'disk', msg: 'disk-free check unsupported — skipped' });
  } else if (freeMb < MIN_DISK_MB) {
    checks.push(fail('disk', `only ${freeMb}MB free, need ${MIN_DISK_MB}MB`));
    return { ok: false, checks };
  } else {
    checks.push(pass('disk'));
  }

  return { ok: true, checks, plan };
}

export function isWithinWindow(windowCfg, now) {
  const [sh, sm] = windowCfg.start.split(':').map(Number);
  const [eh, em] = windowCfg.end.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}
