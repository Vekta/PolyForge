import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

function windowPath() {
  const dir = resolve(homedir(), '.polyforge');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return resolve(dir, 'token-window.json');
}

function loadWindow() {
  const p = windowPath();
  if (!existsSync(p)) return { entries: [] };
  try { return JSON.parse(readFileSync(p, 'utf-8')); }
  catch { return { entries: [] }; }
}

function saveWindow(w) {
  writeFileSync(windowPath(), JSON.stringify(w, null, 2));
}

export function recordUsage({ routine, inputTokens, outputTokens, costUsd, model }) {
  const w = loadWindow();
  w.entries.push({
    ts: Date.now(),
    routine,
    inputTokens: inputTokens || 0,
    outputTokens: outputTokens || 0,
    costUsd: costUsd || 0,
    model: model || 'unknown',
  });
  w.entries = pruneOld(w.entries, 300);
  saveWindow(w);
}

function pruneOld(entries, minutes) {
  const cutoff = Date.now() - minutes * 60 * 1000;
  return entries.filter(e => e.ts >= cutoff);
}

export function summary(windowMinutes = 300) {
  const w = loadWindow();
  const entries = pruneOld(w.entries, windowMinutes);
  const totalIn = entries.reduce((s, e) => s + e.inputTokens, 0);
  const totalOut = entries.reduce((s, e) => s + e.outputTokens, 0);
  const totalCost = entries.reduce((s, e) => s + e.costUsd, 0);
  const byRoutine = {};
  for (const e of entries) {
    byRoutine[e.routine] = byRoutine[e.routine] || { runs: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    byRoutine[e.routine].runs += 1;
    byRoutine[e.routine].inputTokens += e.inputTokens;
    byRoutine[e.routine].outputTokens += e.outputTokens;
    byRoutine[e.routine].costUsd += e.costUsd;
  }
  return { windowMinutes, runs: entries.length, totalIn, totalOut, totalCost, byRoutine };
}
