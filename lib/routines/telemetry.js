import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_WINDOW_MINUTES = 300;
const REGRESSION_FACTOR = 1.5;
const REGRESSION_MIN_SAMPLES = 3;

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

export function recordUsage({
  routine,
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheCreationTokens,
  costUsd,
  model,
  ts,
}) {
  const w = loadWindow();
  w.entries.push({
    ts: ts || Date.now(),
    routine,
    inputTokens: inputTokens || 0,
    outputTokens: outputTokens || 0,
    cacheReadTokens: cacheReadTokens || 0,
    cacheCreationTokens: cacheCreationTokens || 0,
    costUsd: costUsd || 0,
    model: model || 'unknown',
  });
  w.entries = pruneOld(w.entries, DEFAULT_WINDOW_MINUTES);
  saveWindow(w);
}

function pruneOld(entries, minutes) {
  const cutoff = Date.now() - minutes * 60 * 1000;
  return entries.filter(e => e.ts >= cutoff);
}

function hitRate(cacheRead, cacheCreation, input) {
  const totalInput = cacheRead + cacheCreation + input;
  if (totalInput === 0) return 0;
  return cacheRead / totalInput;
}

export function routineAverageCost(routine, windowMinutes = DEFAULT_WINDOW_MINUTES) {
  const entries = pruneOld(loadWindow().entries, windowMinutes).filter(e => e.routine === routine);
  if (entries.length === 0) return null;
  const total = entries.reduce((s, e) => s + e.costUsd, 0);
  return { runs: entries.length, avgCostUsd: total / entries.length };
}

export function detectCostRegression(routine, costUsd, windowMinutes = DEFAULT_WINDOW_MINUTES) {
  const avg = routineAverageCost(routine, windowMinutes);
  if (!avg || avg.runs < REGRESSION_MIN_SAMPLES || avg.avgCostUsd <= 0) {
    return { regressed: false, baselineRuns: avg ? avg.runs : 0 };
  }
  const ratio = costUsd / avg.avgCostUsd;
  return {
    regressed: ratio >= REGRESSION_FACTOR,
    ratio,
    avgCostUsd: avg.avgCostUsd,
    baselineRuns: avg.runs,
  };
}

export function summary(windowMinutes = DEFAULT_WINDOW_MINUTES) {
  const w = loadWindow();
  const entries = pruneOld(w.entries, windowMinutes);
  const totalIn = entries.reduce((s, e) => s + e.inputTokens, 0);
  const totalOut = entries.reduce((s, e) => s + e.outputTokens, 0);
  const totalCacheRead = entries.reduce((s, e) => s + (e.cacheReadTokens || 0), 0);
  const totalCacheCreation = entries.reduce((s, e) => s + (e.cacheCreationTokens || 0), 0);
  const totalCost = entries.reduce((s, e) => s + e.costUsd, 0);
  const byRoutine = {};
  for (const e of entries) {
    const r = byRoutine[e.routine] || {
      runs: 0, inputTokens: 0, outputTokens: 0,
      cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0,
    };
    r.runs += 1;
    r.inputTokens += e.inputTokens;
    r.outputTokens += e.outputTokens;
    r.cacheReadTokens += e.cacheReadTokens || 0;
    r.cacheCreationTokens += e.cacheCreationTokens || 0;
    r.costUsd += e.costUsd;
    byRoutine[e.routine] = r;
  }
  for (const r of Object.values(byRoutine)) {
    r.cacheHitRate = hitRate(r.cacheReadTokens, r.cacheCreationTokens, r.inputTokens);
  }
  return {
    windowMinutes,
    runs: entries.length,
    totalIn,
    totalOut,
    totalCacheRead,
    totalCacheCreation,
    cacheHitRate: hitRate(totalCacheRead, totalCacheCreation, totalIn),
    totalCost,
    byRoutine,
  };
}
