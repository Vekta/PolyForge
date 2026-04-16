import { existsSync, mkdirSync, openSync, closeSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

function lockDir() {
  const dir = resolve(homedir(), '.polyforge', 'routines');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function lockPath() {
  return resolve(lockDir(), '.lock');
}

export function acquireLock(ownerName) {
  const p = lockPath();
  if (existsSync(p)) {
    const { pid, owner, ts } = JSON.parse(readFileSync(p, 'utf-8'));
    if (pid && isAlive(pid)) {
      return { acquired: false, heldBy: owner, pid, since: ts };
    }
    unlinkSync(p);
  }
  writeFileSync(p, JSON.stringify({
    pid: process.pid,
    owner: ownerName,
    ts: new Date().toISOString(),
  }));
  return { acquired: true };
}

export function releaseLock() {
  const p = lockPath();
  if (existsSync(p)) unlinkSync(p);
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}
