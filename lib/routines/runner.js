import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadRoutinesConfig, findRoutine } from './config.js';
import { preflight } from './preflight.js';
import { acquireLock, releaseLock } from './lock.js';
import { addWorktree } from './worktree.js';
import { buildSystemPrompt } from './prompt-builder.js';
import { logEvent } from './logger.js';
import { recordUsage } from './telemetry.js';
import { rateLimitFromClaudeError } from './rate-limit.js';

export async function runRoutine({ projectRoot, routineName, runNow = false, dry = false }) {
  const config = loadRoutinesConfig(projectRoot);
  const routine = findRoutine(config, routineName);

  if (!routine.enabled) {
    logEvent(routineName, { type: 'skip', reason: 'disabled' });
    return { ok: false, reason: 'disabled' };
  }

  const pf = preflight(projectRoot, config, routineName, { skipWindow: runNow });
  if (!pf.ok) {
    const failed = pf.checks.find(c => !c.ok);
    logEvent(routineName, { type: 'preflight-fail', check: failed?.code, msg: failed?.msg });
    return { ok: false, reason: 'preflight', checks: pf.checks };
  }

  let lockHeld = false;
  if (config.concurrency?.serial_lock) {
    const lock = acquireLock(routineName);
    if (!lock.acquired) {
      logEvent(routineName, { type: 'skip', reason: `lock held by ${lock.heldBy}` });
      return { ok: false, reason: 'lock-held', heldBy: lock.heldBy };
    }
    lockHeld = true;
  }

  const effectiveDry = dry || routine.first_run_dry === true;
  let wt;
  try {
    wt = addWorktree(projectRoot, config, routineName);
    logEvent(routineName, { type: 'worktree-created', path: wt.path, branch: wt.branch });

    const sp = buildSystemPrompt(projectRoot, routine);
    const prompt = loadPrompt(projectRoot, routine);
    const budget = config.budget.max_budget_usd_per_run;

    const args = buildClaudeArgs({ routine, systemPrompt: sp, budget, dry: effectiveDry, prompt });

    logEvent(routineName, { type: 'claude-invoke-start', model: routine.model, budget, dry: effectiveDry });
    const result = spawnSync('claude', args, {
      cwd: wt.path,
      encoding: 'utf-8',
      timeout: (routine.max_turns || 30) * 60 * 1000,
      maxBuffer: 50 * 1024 * 1024,
    });

    const parsed = safeParse(result.stdout);
    if (parsed) {
      logEvent(routineName, {
        type: 'claude-result',
        subtype: parsed.subtype,
        is_error: parsed.is_error,
        turns: parsed.num_turns,
        cost: parsed.total_cost_usd,
      });
      recordUsage({
        routine: routineName,
        inputTokens: parsed.usage?.input_tokens || 0,
        outputTokens: parsed.usage?.output_tokens || 0,
        costUsd: parsed.total_cost_usd || 0,
        model: routine.model,
      });
      if (parsed.subtype === 'error_max_budget_usd') {
        logEvent(routineName, { type: 'budget-exceeded', errors: parsed.errors });
      }
      if (rateLimitFromClaudeError(parsed)) {
        logEvent(routineName, { type: 'rate-limited', status: parsed.api_error_status });
      }
    } else {
      logEvent(routineName, { type: 'claude-invoke-fail', stderr: (result.stderr || '').slice(0, 2000) });
    }

    const ok = Boolean(parsed) && parsed.is_error !== true;
    return { ok, parsed, worktree: wt, dry: effectiveDry };
  } catch (e) {
    logEvent(routineName, { type: 'error', msg: e.message });
    return { ok: false, error: e.message };
  } finally {
    if (lockHeld) releaseLock();
  }
}

function buildClaudeArgs({ routine, systemPrompt, budget, dry, prompt }) {
  const args = [
    '-p',
    '--output-format', 'json',
    '--model', routine.model || 'sonnet',
    '--max-budget-usd', String(budget),
    '--max-turns', String(routine.max_turns || 30),
    '--permission-mode', 'bypassPermissions',
    '--allowedTools', routine.allowed_tools.join(','),
  ];
  if (systemPrompt.bare) args.push('--bare');
  if (systemPrompt.file) args.push('--append-system-prompt-file', systemPrompt.file);
  const finalPrompt = dry ? `${prompt}\n\n---\nDRY-RUN MODE: describe what you would do but do NOT push, merge, or create PRs.` : prompt;
  args.push('--', finalPrompt);
  return args;
}

function loadPrompt(projectRoot, routine) {
  const t = routine.template || '';
  const match = t.match(/^(builtin|custom):(.+)$/);
  if (!match) {
    throw new Error(`Template must be "builtin:<name>" or "custom:<name>", got: "${t}"`);
  }
  const name = match[2];
  const p = resolve(projectRoot, 'templates', 'routines', name, 'prompt.md');
  if (!existsSync(p)) throw new Error(`Template prompt not found: ${p}`);
  return readFileSync(p, 'utf-8');
}

function safeParse(str) {
  if (!str) return null;
  try { return JSON.parse(str); }
  catch {
    const lines = str.split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try { return JSON.parse(lines[i]); } catch {}
    }
    return null;
  }
}
