import { appendFileSync, mkdirSync, existsSync, statSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const MAX_BYTES = 10 * 1024 * 1024;

function logDir() {
  const dir = resolve(homedir(), '.polyforge', 'logs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function logEvent(routineName, event) {
  const dir = logDir();
  const path = resolve(dir, `${routineName}.jsonl`);
  rotateIfNeeded(path);
  const entry = { ts: new Date().toISOString(), ...event };
  appendFileSync(path, JSON.stringify(entry) + '\n');
}

function rotateIfNeeded(path) {
  if (!existsSync(path)) return;
  const { size } = statSync(path);
  if (size < MAX_BYTES) return;
  const rotated = `${path}.${Date.now()}.old`;
  renameSync(path, rotated);
}

export function logPath(routineName) {
  return resolve(logDir(), `${routineName}.jsonl`);
}
