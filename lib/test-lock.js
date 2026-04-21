import { existsSync, mkdirSync, openSync, closeSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const LOCK_PATH = resolve(homedir(), '.polyforge', 'ci-mirror.lock');
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

function ensureLockDir() {
  const dir = resolve(homedir(), '.polyforge');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export async function acquireTestLock({ owner, timeoutMs = DEFAULT_TIMEOUT_MS, pollMs = 500 } = {}) {
  ensureLockDir();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!existsSync(LOCK_PATH)) {
      writeFileSync(LOCK_PATH, JSON.stringify({
        pid: process.pid,
        owner: owner || 'unknown',
        acquiredAt: new Date().toISOString(),
      }));
      return { acquired: true, waited: Date.now() - start };
    }
    const heldBy = readLock();
    if (heldBy && !isPidAlive(heldBy.pid)) {
      unlinkSync(LOCK_PATH);
      continue;
    }
    await sleep(pollMs);
  }
  return { acquired: false, waited: Date.now() - start, heldBy: readLock() };
}

export function releaseTestLock() {
  if (existsSync(LOCK_PATH)) {
    try { unlinkSync(LOCK_PATH); return true; }
    catch { return false; }
  }
  return false;
}

export function readLock() {
  if (!existsSync(LOCK_PATH)) return null;
  try { return JSON.parse(readFileSync(LOCK_PATH, 'utf-8')); }
  catch { return null; }
}

function isPidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export { LOCK_PATH, DEFAULT_TIMEOUT_MS };
