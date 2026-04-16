const VALID_PROFILES = ['light', 'standard', 'full', 'unleashed', 'budget-driven'];
const VALID_STRATEGIES = ['full', 'targeted', 'minimal'];
const VALID_AUTONOMY = ['auto-merge', 'pr-review', 'mixed', 'suggest'];
const VALID_GROUPING = ['by-severity', 'by-package', 'grouped'];

export function validateRoutinesConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    errors.push('routines: must be an object');
    return { valid: false, errors };
  }

  if (!VALID_PROFILES.includes(config.profile)) {
    errors.push(`profile: must be one of ${VALID_PROFILES.join(', ')}, got "${config.profile}"`);
  }

  const w = config.window;
  if (!w || !/^\d{2}:\d{2}$/.test(w.start) || !/^\d{2}:\d{2}$/.test(w.end)) {
    errors.push('window: start and end must be HH:MM');
  }

  const b = config.budget;
  if (!b || typeof b.max_budget_usd_per_run !== 'number' || b.max_budget_usd_per_run <= 0) {
    errors.push('budget.max_budget_usd_per_run: must be positive number');
  }

  const iso = config.isolation;
  if (!iso || iso.strategy !== 'worktree' || !iso.base_branch) {
    errors.push('isolation: strategy must be "worktree" and base_branch required');
  }

  if (!Array.isArray(config.routines) || config.routines.length === 0) {
    errors.push('routines: must be non-empty array');
  } else {
    config.routines.forEach((r, i) => {
      if (!r.name || !/^[a-z][a-z0-9-]*$/.test(r.name)) {
        errors.push(`routines[${i}].name: kebab-case required`);
      }
      if (!VALID_STRATEGIES.includes(r.system_prompt_strategy)) {
        errors.push(`routines[${i}].system_prompt_strategy: must be one of ${VALID_STRATEGIES.join(', ')}`);
      }
      if (!VALID_AUTONOMY.includes(r.autonomy)) {
        errors.push(`routines[${i}].autonomy: must be one of ${VALID_AUTONOMY.join(', ')}`);
      }
      if (!Array.isArray(r.allowed_tools) || r.allowed_tools.length === 0) {
        errors.push(`routines[${i}].allowed_tools: must be non-empty array`);
      }
      if (typeof r.max_turns !== 'number' || r.max_turns <= 0) {
        errors.push(`routines[${i}].max_turns: must be positive`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export { VALID_PROFILES, VALID_STRATEGIES, VALID_AUTONOMY, VALID_GROUPING };
