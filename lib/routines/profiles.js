export const PROFILE_DEFAULTS = {
  light: {
    description: 'Tight quota — minimal footprint, weekly cadence',
    enabled_routines: ['deps-security', 'release-notes', 'daily-reporter'],
    default_model: 'haiku',
    default_max_budget_usd_per_run: 0.5,
    cadence_hint: 'weekly',
  },
  standard: {
    description: 'Comfortable quota — hygiene + backlog, nightly',
    enabled_routines: ['deps-security', 'release-notes', 'refacto-scanner', 'backlog-groomer', 'daily-reporter'],
    default_model: 'sonnet',
    default_max_budget_usd_per_run: 1.0,
    cadence_hint: 'nightly',
  },
  full: {
    description: 'Large quota — full dev workflow',
    enabled_routines: ['issue-worker', 'pr-reviewer', 'deps-security', 'release-notes', 'refacto-scanner', 'backlog-groomer', 'daily-reporter'],
    default_model: 'sonnet',
    default_max_budget_usd_per_run: 2.0,
    cadence_hint: 'nightly+',
  },
  unleashed: {
    description: 'Very large quota — all bundled routines + unlimited custom',
    enabled_routines: ['issue-worker', 'pr-reviewer', 'deps-security', 'release-notes', 'refacto-scanner', 'backlog-groomer', 'daily-reporter'],
    default_model: 'sonnet',
    default_max_budget_usd_per_run: 5.0,
    cadence_hint: 'nightly, multiple runs allowed',
  },
  'budget-driven': {
    description: 'API key — cost-capped via --max-budget-usd',
    enabled_routines: ['deps-security', 'daily-reporter'],
    default_model: 'haiku',
    default_max_budget_usd_per_run: 1.0,
    cadence_hint: 'user-defined',
  },
};

const ROUTINE_DEFAULTS = {
  'issue-worker': {
    template: 'builtin:issue-worker',
    autonomy: 'pr-review',
    system_prompt_strategy: 'full',
    max_turns: 80,
    allowed_tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(git *)', 'Bash(gh *)', 'Bash(npm *)', 'Bash(node *)'],
    schedule: '0 23 * * *',
  },
  'pr-reviewer': {
    template: 'builtin:pr-reviewer',
    autonomy: 'auto-merge',
    system_prompt_strategy: 'targeted',
    system_prompt_sources: ['rules/common/security.md', 'rules/common/coding-style.md'],
    max_turns: 30,
    allowed_tools: ['Read', 'Glob', 'Grep', 'Bash(git *)', 'Bash(gh *)'],
    auto_merge_allowlist: ['patch-version-bump', 'lint-only', 'changelog-only'],
    schedule: '0 1 * * *',
  },
  'refacto-scanner': {
    template: 'builtin:refacto-scanner',
    autonomy: 'pr-review',
    system_prompt_strategy: 'targeted',
    system_prompt_sources: ['rules/common/coding-style.md'],
    max_turns: 40,
    allowed_tools: ['Read', 'Glob', 'Grep', 'Edit', 'Bash(git *)', 'Bash(gh *)'],
    schedule: '0 2 * * *',
  },
  'deps-security': {
    template: 'builtin:deps-security',
    autonomy: 'mixed',
    system_prompt_strategy: 'minimal',
    max_turns: 15,
    allowed_tools: ['Bash(npm *)', 'Bash(git *)', 'Bash(gh *)', 'Read', 'Edit'],
    grouping_strategy: 'by-severity',
    pr_policy: { patch: 'auto-merge', minor: 'to-review', major: 'to-review' },
    schedule: '0 0 * * *',
  },
  'backlog-groomer': {
    template: 'builtin:backlog-groomer',
    autonomy: 'suggest',
    system_prompt_strategy: 'targeted',
    system_prompt_sources: ['rules/common/git-workflow.md'],
    max_turns: 20,
    allowed_tools: ['Bash(gh *)', 'Read'],
    schedule: '30 3 * * *',
  },
  'release-notes': {
    template: 'builtin:release-notes',
    autonomy: 'pr-review',
    system_prompt_strategy: 'minimal',
    max_turns: 10,
    allowed_tools: ['Bash(git *)', 'Bash(gh *)', 'Read', 'Write'],
    schedule: '0 4 * * 0',
  },
  'daily-reporter': {
    template: 'builtin:daily-reporter',
    autonomy: 'suggest',
    system_prompt_strategy: 'minimal',
    max_turns: 5,
    allowed_tools: ['Read', 'Bash(gh *)', 'Write'],
    schedule: '15 7 * * *',
  },
};

export function buildRoutinesConfig(profile, detectedPlan, window) {
  const prof = PROFILE_DEFAULTS[profile];
  if (!prof) throw new Error(`Unknown profile "${profile}"`);
  const routines = prof.enabled_routines.map(name => ({
    name,
    enabled: true,
    first_run_dry: true,
    ...ROUTINE_DEFAULTS[name],
    model: prof.default_model,
  }));
  return {
    profile,
    detected_plan: detectedPlan,
    plan_detection: {
      known_plans_version: '2026-04-16',
      unknown_plan_logged: null,
    },
    window,
    budget: {
      max_budget_usd_per_run: prof.default_max_budget_usd_per_run,
      telemetry_only_rolling_window_minutes: 300,
    },
    isolation: {
      strategy: 'worktree',
      base_branch: 'main',
      base_ref: 'origin/main',
      worktree_root: '~/.polyforge/worktrees',
      worktree_path_pattern: '{root}/{project_hash}/{routine_name}/{timestamp}',
      cleanup_on_pr_closed_after_days: 3,
      cleanup_schedule_offset_minutes: 60,
    },
    labels: {
      auto_merge: 'routine:auto-merge',
      needs_review: 'routine:to-review',
    },
    concurrency: {
      serial_lock: true,
      max_parallel: 1,
    },
    reporting: {
      daily_reporter_offset_minutes: 15,
      notify: 'github-issue',
    },
    routines,
  };
}

export { ROUTINE_DEFAULTS };
