import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const KNOWN_PLANS_VERSION = '2026-04-16';

const PLAN_TO_PROFILE = {
  pro: 'light',
  max: 'standard',
  max_5x: 'standard',
  max_20x: 'full',
  team: 'unleashed',
  enterprise: 'unleashed',
  apiKey: 'budget-driven',
};

export function detectPlan() {
  let raw;
  try {
    raw = execFileSync('claude', ['auth', 'status'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
  } catch (e) {
    return { ok: false, reason: 'claude auth status failed', error: e.message };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'auth status output is not JSON', raw };
  }

  if (!parsed.loggedIn) {
    return { ok: false, reason: 'not logged in', raw: parsed };
  }

  const subscriptionType = parsed.subscriptionType || (parsed.authMethod === 'apiKey' ? 'apiKey' : null);
  if (!subscriptionType) {
    return { ok: false, reason: 'no subscriptionType exposed', raw: parsed };
  }

  const profile = PLAN_TO_PROFILE[subscriptionType];
  if (!profile) {
    logUnknownPlan(subscriptionType, parsed);
    return {
      ok: true,
      plan: subscriptionType,
      profile: 'standard',
      fallback: true,
      reason: `unknown plan "${subscriptionType}", falling back to standard — please override if incorrect`,
    };
  }

  return {
    ok: true,
    plan: subscriptionType,
    profile,
    fallback: false,
    authMethod: parsed.authMethod,
    orgName: parsed.orgName || null,
    knownPlansVersion: KNOWN_PLANS_VERSION,
  };
}

function logUnknownPlan(plan, raw) {
  const dir = resolve(homedir(), '.polyforge');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), plan, authMethod: raw.authMethod }) + '\n';
  appendFileSync(resolve(dir, 'unknown-plans.jsonl'), line);
}

export { PLAN_TO_PROFILE, KNOWN_PLANS_VERSION };
