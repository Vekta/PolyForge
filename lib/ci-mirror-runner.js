import { spawnSync } from 'node:child_process';

export function runCiMirror(commands, { cwd, env, onStep } = {}) {
  const results = [];
  const blocking = commands.filter(c => c.blocking !== false);
  for (const cmd of blocking) {
    if (onStep) onStep({ phase: 'start', cmd });
    const start = Date.now();
    const result = spawnSync('bash', ['-c', cmd.cmd], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...env },
      encoding: 'utf-8',
      timeout: 30 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
    });
    const durationMs = Date.now() - start;
    const entry = {
      name: cmd.name || cmd.cmd.split(/\s+/)[0],
      cmd: cmd.cmd,
      origin: cmd.origin || 'unknown',
      exitCode: result.status,
      signal: result.signal,
      durationMs,
      stdout: (result.stdout || '').slice(-8000),
      stderr: (result.stderr || '').slice(-8000),
      ok: result.status === 0,
    };
    results.push(entry);
    if (onStep) onStep({ phase: 'end', ...entry });
    if (!entry.ok) break;
  }
  return {
    ok: results.every(r => r.ok),
    results,
    totalMs: results.reduce((s, r) => s + r.durationMs, 0),
  };
}
