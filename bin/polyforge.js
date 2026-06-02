#!/usr/bin/env node

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, symlinkSync, readlinkSync, unlinkSync, readFileSync, writeFileSync, readdirSync, statSync, lstatSync } from 'fs';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CLAUDE_DIR = resolve(homedir(), '.claude');
const FORCE = process.argv.includes('--force');

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

const commands = {
  install,
  uninstall,
  update,
  'add-skill': addSkill,
  'remove-skill': removeSkill,
  list: listSkills,
  help,
  '--version': version,
  '-v': version,
  // Routines (PR #4)
  '_routine-run': routineRun,
  '_routines-status': routinesStatus,
  '_routines-cleanup': routinesCleanup,
  '_plan-detect': planDetect,
  '_routines-build-config': routinesBuildConfig,
  '_routines-install-plist': routinesInstallPlist,
  '_routines-uninstall-plist': routinesUninstallPlist,
  // Dev workflow sync (PR #5 — this branch)
  '_resolve-default-branch': resolveDefaultBranchCmd,
  '_parse-workflows': parseWorkflowsCmd,
  '_detect-parallelism': detectParallelismCmd,
  '_fetch-jira-statuses': fetchJiraStatusesCmd,
  '_detect-migrations': detectMigrationsCmd,
  '_apply-migrations': applyMigrationsCmd,
  '_jira-transition': jiraTransitionCmd,
  '_jira-comment': jiraCommentCmd,
  '_ci-mirror-sync': ciMirrorSyncCmd,
  '_ci-mirror-run': ciMirrorRunCmd,
  '_ci-fallback-verbs': ciFallbackVerbsCmd,
  '_ci-learn': ciLearnCmd,
  '_parallel-plan': parallelPlanCmd,
  '_parallel-create-worktrees': parallelCreateWorktreesCmd,
  '_test-lock-acquire': testLockAcquireCmd,
  '_test-lock-release': testLockReleaseCmd,
  '_recommend-allowlist': recommendAllowlistCmd,
};

function flag(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

function positional(index) {
  return process.argv[3 + index];
}

async function resolveDefaultBranchCmd() {
  const projectRoot = positional(0) || process.cwd();
  const { resolveDefaultBranch } = await import('../lib/default-branch.js');
  const result = resolveDefaultBranch(projectRoot);
  console.log(JSON.stringify(result, null, 2));
}

async function parseWorkflowsCmd() {
  const projectRoot = flag('--project') || process.cwd();
  const defaultBranch = flag('--default-branch') || 'main';
  const { parseWorkflows } = await import('../lib/workflow-parser.js');
  const { parseGitlabCI } = await import('../lib/workflow-parser-gitlab.js');
  const gh = parseWorkflows(projectRoot, { defaultBranch });
  const gl = parseGitlabCI(projectRoot);
  console.log(JSON.stringify({ github: gh, gitlab: gl }, null, 2));
}

async function detectParallelismCmd() {
  const projectRoot = positional(0) || process.cwd();
  const { detectParallelism } = await import('../lib/parallelism-detector.js');
  const result = detectParallelism(projectRoot);
  console.log(JSON.stringify(result, null, 2));
}

async function recommendAllowlistCmd() {
  const projectRoot = flag('--project') || process.cwd();
  const detectionRaw = flag('--detection');
  let detection = {};
  if (detectionRaw) {
    try {
      detection = JSON.parse(detectionRaw);
    } catch {
      console.error('--detection must be valid JSON');
      process.exit(2);
    }
  }
  const { recommendedAllowlist, mergeIntoSettings } = await import('../lib/permission-allowlist.js');
  const patterns = recommendedAllowlist(detection);
  const settingsPath = resolve(projectRoot, '.claude', 'settings.json');
  let existing = {};
  if (existsSync(settingsPath)) {
    try {
      existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch {
      existing = {};
    }
  }
  const merged = mergeIntoSettings(existing, patterns);
  const write = process.argv.includes('--write');
  if (write) {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`);
  }
  console.log(JSON.stringify({ patterns, settingsPath, written: write, settings: merged }, null, 2));
}

async function fetchJiraStatusesCmd() {
  const domain = flag('--domain');
  const projectKey = flag('--project-key');
  const email = flag('--email') || process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  if (!domain || !projectKey) {
    console.error('Usage: polyforge _fetch-jira-statuses --domain <d> --project-key <K> [--email <e>]');
    console.error('  Requires JIRA_API_TOKEN env var (and JIRA_EMAIL if not passed via --email)');
    process.exit(2);
  }
  const { fetchProjectStatuses } = await import('../lib/jira-statuses.js');
  try {
    const result = await fetchProjectStatuses({ domain, projectKey, email, apiToken });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e.message }, null, 2));
    process.exit(1);
  }
}

async function detectMigrationsCmd() {
  const projectRoot = positional(0) || process.cwd();
  const configPath = resolve(projectRoot, 'polyforge.json');
  if (!existsSync(configPath)) {
    console.log(JSON.stringify({ migrations: [], reason: 'no polyforge.json' }, null, 2));
    return;
  }
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const { detectNeededMigrations, applyMigrations, computeDiff, assertConfigClean } = await import('../lib/config/migrator.js');
  const clean = assertConfigClean(projectRoot);
  const migrations = detectNeededMigrations(config);
  const after = applyMigrations(config, migrations);
  const diff = computeDiff(config, after);
  console.log(JSON.stringify({ clean, migrations, diff: diff.diff, changed: diff.changed }, null, 2));
}

async function jiraTransitionCmd() {
  const domain = flag('--domain');
  const issueKey = flag('--key');
  const targetStatus = flag('--status');
  const comment = flag('--comment');
  if (!domain || !issueKey || !targetStatus) {
    console.error('Usage: polyforge _jira-transition --domain <d> --key <K> --status <S> [--comment <text>]');
    console.error('  Requires JIRA_API_TOKEN and JIRA_EMAIL env vars');
    process.exit(2);
  }
  const { transitionIssue } = await import('../lib/jira-client.js');
  const result = await transitionIssue({ domain, issueKey, targetStatus, comment });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok || result.noop ? 0 : 1);
}

async function jiraCommentCmd() {
  const domain = flag('--domain');
  const issueKey = flag('--key');
  const body = flag('--body');
  if (!domain || !issueKey || !body) {
    console.error('Usage: polyforge _jira-comment --domain <d> --key <K> --body <text>');
    process.exit(2);
  }
  const { postComment } = await import('../lib/jira-client.js');
  const result = await postComment(domain, issueKey, body);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok || result.noop ? 0 : 1);
}

async function ciMirrorSyncCmd() {
  const projectRoot = flag('--project') || process.cwd();
  const defaultBranch = flag('--default-branch') || 'main';
  const { syncIfNeeded } = await import('../lib/ci-mirror-sync.js');
  const result = syncIfNeeded(projectRoot, { defaultBranch });
  console.log(JSON.stringify(result, null, 2));
}

async function ciMirrorRunCmd() {
  const projectRoot = flag('--project') || process.cwd();
  const configPath = resolve(projectRoot, 'polyforge.json');
  if (!existsSync(configPath)) {
    console.error('No polyforge.json, run /forge first');
    process.exit(2);
  }
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const commands = [
    ...(config.pipeline?.ciMirror?.commands || []),
    ...(config.pipeline?.ciMirror?.learnedCommands || []),
  ];
  if (commands.length === 0) {
    const { detectFallbackCommands } = await import('../lib/fallback-verbs.js');
    const fb = detectFallbackCommands(projectRoot);
    commands.push(...fb.commands);
    console.error(`[ci-mirror] no ciMirror.commands — using fallback (detected ${fb.detected.join(', ') || 'none'})`);
  }
  const { runCiMirror } = await import('../lib/ci-mirror-runner.js');
  const result = runCiMirror(commands, { cwd: projectRoot });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

async function ciFallbackVerbsCmd() {
  const projectRoot = flag('--project') || process.cwd();
  const { detectFallbackCommands } = await import('../lib/fallback-verbs.js');
  const result = detectFallbackCommands(projectRoot);
  console.log(JSON.stringify(result, null, 2));
}

async function ciLearnCmd() {
  const projectRoot = flag('--project') || process.cwd();
  const prNumber = flag('--pr');
  const configPath = resolve(projectRoot, 'polyforge.json');
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf-8')) : {};
  const userExclude = config?.pipeline?.ciMirror?.excludePatterns || [];
  const { fetchFailedRunLog, extractFailingCommand, shouldLearn, appendLearnedCommand } = await import('../lib/ci-failure-extractor.js');
  const fetched = fetchFailedRunLog(projectRoot, prNumber);
  if (!fetched) {
    console.log(JSON.stringify({ ok: false, reason: 'no-failed-run-found' }, null, 2));
    return;
  }
  const cmd = extractFailingCommand(fetched.log);
  if (!cmd) {
    console.log(JSON.stringify({ ok: false, reason: 'no-command-extracted', runId: fetched.runId }, null, 2));
    return;
  }
  if (!shouldLearn(cmd, userExclude)) {
    console.log(JSON.stringify({ ok: false, reason: 'excluded-pattern', cmd }, null, 2));
    return;
  }
  if (config?.pipeline?.ciMirror?.learningConsent === 'declined') {
    console.log(JSON.stringify({ ok: false, reason: 'consent-declined', cmd }, null, 2));
    return;
  }
  const result = appendLearnedCommand({
    projectRoot,
    cmd,
    fromRunUrl: `https://github.com/.../actions/runs/${fetched.runId}`,
  });
  console.log(JSON.stringify({ ok: true, cmd, runId: fetched.runId, ...result }, null, 2));
}

async function parallelPlanCmd() {
  const projectRoot = flag('--project') || process.cwd();
  const kind = flag('--kind') || 'fix';
  const ticketsRaw = flag('--tickets') || '';
  const ticketArgs = ticketsRaw.split(',').map(s => s.trim()).filter(Boolean);
  const configPath = resolve(projectRoot, 'polyforge.json');
  if (!existsSync(configPath)) {
    console.error('No polyforge.json, run /forge first');
    process.exit(2);
  }
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const { parseTicketList, planExecution } = await import('../lib/parallel-orchestrator.js');
  const tickets = parseTicketList(ticketArgs);
  if (tickets.length === 0) {
    console.error('No valid tickets parsed from --tickets. Formats: #123 or PROJ-123');
    process.exit(2);
  }
  const plan = await planExecution({ projectRoot, config, tickets, kind });
  console.log(JSON.stringify(plan, null, 2));
}

async function parallelCreateWorktreesCmd() {
  const projectRoot = flag('--project') || process.cwd();
  const planJson = flag('--plan');
  if (!planJson) {
    console.error('Usage: polyforge _parallel-create-worktrees --project <p> --plan \'[{...}]\'');
    process.exit(2);
  }
  const plan = JSON.parse(planJson);
  const { createWorktreesForPlan } = await import('../lib/parallel-orchestrator.js');
  const results = createWorktreesForPlan({ projectRoot, plan });
  console.log(JSON.stringify(results, null, 2));
}

async function testLockAcquireCmd() {
  const owner = flag('--owner') || 'cli';
  const timeoutMs = Number(flag('--timeout-ms')) || undefined;
  const { acquireTestLock } = await import('../lib/test-lock.js');
  const result = await acquireTestLock({ owner, timeoutMs });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.acquired ? 0 : 1);
}

async function testLockReleaseCmd() {
  const { releaseTestLock } = await import('../lib/test-lock.js');
  const released = releaseTestLock();
  console.log(JSON.stringify({ released }, null, 2));
}

async function applyMigrationsCmd() {
  const projectRoot = positional(0) || process.cwd();
  const configPath = resolve(projectRoot, 'polyforge.json');
  if (!existsSync(configPath)) {
    console.error('No polyforge.json found');
    process.exit(2);
  }
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const { detectNeededMigrations, applyMigrations, atomicWriteConfig, assertConfigClean } = await import('../lib/config/migrator.js');
  const clean = assertConfigClean(projectRoot);
  if (!clean.clean) {
    console.error(`polyforge.json has uncommitted changes. Commit or stash first.\n${clean.status || ''}`);
    process.exit(3);
  }
  const migrations = detectNeededMigrations(config);
  const next = applyMigrations(config, migrations);
  atomicWriteConfig(projectRoot, next);
  console.log(JSON.stringify({ applied: migrations.map(m => m.id), written: true }, null, 2));
}

const command = process.argv[2] || 'help';

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  commands.help();
  process.exit(1);
}

commands[command]();

function version() {
  console.log(`polyforge v${pkg.version}`);
}

function install() {
  console.log(`\nPolyForge v${pkg.version} — Installing skills & rules\n`);

  const targets = [
    { src: resolve(ROOT, 'skills'), dest: resolve(CLAUDE_DIR, 'skills'), type: 'skills' },
    { src: resolve(ROOT, 'rules'), dest: resolve(CLAUDE_DIR, 'rules'), type: 'rules' },
  ];

  for (const { src, dest, type } of targets) {
    if (!existsSync(src)) continue;

    mkdirSync(dest, { recursive: true });

    const entries = readdirSync(src);
    for (const entry of entries) {
      const srcPath = resolve(src, entry);
      const destPath = resolve(dest, entry.startsWith('polyforge-') ? entry : `polyforge-${entry}`);

      if (existsSync(destPath)) {
        if (isSymlinkTo(destPath, srcPath)) {
          console.log(`  ✓ ${type}/${entry} (already linked)`);
          continue;
        }
        if (FORCE) {
          safeUnlink(destPath);
          symlinkSync(srcPath, destPath);
          console.log(`  ↻ ${type}/${entry} → replaced (--force)`);
          continue;
        }
        console.log(`  ⚠ ${type}/${entry} exists — skipping (use --force to overwrite)`);
        continue;
      }

      symlinkSync(srcPath, destPath);
      console.log(`  + ${type}/${entry} → linked`);
    }
  }

  console.log('\n✓ PolyForge installed. Use /forge in Claude Code to configure a project.\n');
}

function uninstall() {
  console.log('\nPolyForge — Uninstalling\n');

  const dirs = [
    resolve(CLAUDE_DIR, 'skills'),
    resolve(CLAUDE_DIR, 'rules'),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (!entry.startsWith('polyforge-')) continue;
      const fullPath = resolve(dir, entry);
      if (safeUnlink(fullPath)) {
        console.log(`  - Removed ${entry}`);
      }
    }
  }

  console.log('\n✓ PolyForge uninstalled.\n');
}

function update() {
  console.log(`Updating PolyForge to v${pkg.version}...`);
  uninstall();
  install();
}

function addSkill() {
  const names = process.argv.slice(3).filter(a => !a.startsWith('--'));
  if (names.length === 0) {
    console.error('Usage: polyforge add-skill <name> [name2 ...]\n');
    console.log('Available skills:');
    getAvailableSkills().forEach(s => console.log(`  - ${s}`));
    process.exit(1);
  }

  const available = getAvailableSkills();
  const skillsDest = resolve(CLAUDE_DIR, 'skills');
  mkdirSync(skillsDest, { recursive: true });

  for (const name of names) {
    if (!isValidSkillName(name) || !available.includes(name)) {
      console.log(`  ✗ Unknown skill: "${name}". Available: ${available.join(', ')}`);
      continue;
    }

    const srcPath = resolve(ROOT, 'skills', name);
    const destPath = resolve(skillsDest, `polyforge-${name}`);

    if (existsSync(destPath)) {
      if (isSymlinkTo(destPath, srcPath)) {
        console.log(`  ✓ ${name} (already installed)`);
      } else if (FORCE) {
        safeUnlink(destPath);
        symlinkSync(srcPath, destPath);
        console.log(`  ↻ ${name} → replaced (--force)`);
      } else {
        console.log(`  ⚠ ${name} exists — skipping (use --force to overwrite)`);
      }
      continue;
    }

    symlinkSync(srcPath, destPath);
    console.log(`  + ${name} → installed`);
  }
}

function removeSkill() {
  const names = process.argv.slice(3).filter(a => !a.startsWith('--'));
  if (names.length === 0) {
    console.error('Usage: polyforge remove-skill <name> [name2 ...]');
    process.exit(1);
  }

  const skillsDest = resolve(CLAUDE_DIR, 'skills');

  for (const name of names) {
    if (!isValidSkillName(name)) {
      console.log(`  ✗ Invalid skill name: "${name}"`);
      continue;
    }

    const destPath = resolve(skillsDest, `polyforge-${name}`);
    if (!existsSync(destPath)) {
      console.log(`  - ${name} (not installed)`);
      continue;
    }

    if (safeUnlink(destPath)) {
      console.log(`  - ${name} → removed`);
    } else {
      console.error(`  ✗ Failed to remove ${name}`);
    }
  }
}

function listSkills() {
  const available = getAvailableSkills();
  const skillsDest = resolve(CLAUDE_DIR, 'skills');

  console.log('\nPolyForge Skills:\n');
  for (const name of available) {
    const destPath = resolve(skillsDest, `polyforge-${name}`);
    const installed = existsSync(destPath);
    console.log(`  ${installed ? '✓' : '○'} ${name}`);
  }
  console.log('');
}

function getAvailableSkills() {
  const skillsDir = resolve(ROOT, 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter(entry =>
    statSync(resolve(skillsDir, entry)).isDirectory()
  );
}

function help() {
  console.log(`
PolyForge v${pkg.version} — Self-adaptive Claude Code plugin

Usage:
  npx polyforge install [--force]     Install all skills & rules into ~/.claude/
  npx polyforge uninstall             Remove all PolyForge skills & rules
  npx polyforge update                Reinstall (uninstall + install)
  npx polyforge add-skill <name>      Install a specific skill [--force]
  npx polyforge remove-skill <name>   Remove a specific skill
  npx polyforge list                  Show available skills and install status
  npx polyforge --version             Show version
  npx polyforge help                  Show this help

After install, use these forge-themed slash commands in Claude Code:
  /forge            Set up / configure PolyForge for a project
  /smith            Implement a ticket end-to-end (auto feat/fix) — was /feature + /fix
  /quench           Drive CI to green / stabilize the build — was /fix-ci
  /hallmark         Review a PR, issue, or Jira ticket — was /review
  /assay            Whole-codebase quality audit → report — was /analyse-code
  /blueprint        Map & document the DB schema — was /analyse-db
  /sketch           Plan / explore before building — was /brainstorm
  /probe            Root-cause one defect / exception — was /diagnose
  /mark             Record a defect in the tracker — was /report-issue
  /engrave          Write / refresh docs & context — was /generate-doc
  /temper           Set a project rule / constraint — was /add-rule
  /fold             Consolidate commit history — was /squash
  /embers           Nocturnal routines: light | cast | watch | tend — was /routines-*
`);
}

async function routineRun() {
  const args = process.argv.slice(3);
  const getFlag = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? null : args[i + 1];
  };
  const name = getFlag('--name');
  const projectRoot = getFlag('--project');
  const dry = args.includes('--dry');
  const runNow = args.includes('--run-now');
  if (!name || !projectRoot) {
    console.error('Usage: polyforge _routine-run --name <n> --project <path> [--dry] [--run-now]');
    process.exit(2);
  }
  const { runRoutine } = await import('../lib/routines/runner.js');
  const result = await runRoutine({ projectRoot, routineName: name, runNow, dry });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

async function routinesStatus() {
  const { listInstalledPlists } = await import('../lib/routines/launchd.js');
  const { summary } = await import('../lib/routines/telemetry.js');
  const { isRateLimited } = await import('../lib/routines/rate-limit.js');
  const plists = listInstalledPlists();
  const tel = summary(300);
  const rl = isRateLimited();
  console.log(JSON.stringify({
    installed: plists.map(p => p.routineName),
    telemetry_5h: tel,
    rate_limited: rl,
    pause_file: existsSync(resolve(homedir(), '.polyforge', 'PAUSE')),
  }, null, 2));
}

async function routinesCleanup() {
  const projectRoot = process.argv[3] || process.cwd();
  const { cleanupStaleWorktrees } = await import('../lib/routines/cleanup.js');
  const { loadRoutinesConfig } = await import('../lib/routines/config.js');
  const cfg = loadRoutinesConfig(projectRoot);
  const result = cleanupStaleWorktrees(projectRoot, cfg);
  console.log(JSON.stringify(result, null, 2));
}

async function planDetect() {
  const { detectPlan } = await import('../lib/routines/plan-detector.js');
  const result = detectPlan();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

async function routinesBuildConfig() {
  const args = process.argv.slice(3);
  const getFlag = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? null : args[i + 1];
  };
  const profile = getFlag('--profile');
  const plan = getFlag('--plan');
  const start = getFlag('--start') || '23:00';
  const end = getFlag('--end') || '07:00';
  if (!profile || !plan) {
    console.error('Usage: polyforge _routines-build-config --profile <p> --plan <p> [--start HH:MM] [--end HH:MM]');
    process.exit(2);
  }
  const { buildRoutinesConfig } = await import('../lib/routines/profiles.js');
  const cfg = buildRoutinesConfig(profile, plan, { start, end, stop_before: end });
  console.log(JSON.stringify(cfg, null, 2));
}

async function routinesInstallPlist() {
  const args = process.argv.slice(3);
  const getFlag = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? null : args[i + 1];
  };
  const name = getFlag('--name');
  const projectRoot = getFlag('--project') || process.cwd();
  const schedule = getFlag('--schedule');
  if (!name || !schedule) {
    console.error('Usage: polyforge _routines-install-plist --name <n> --schedule "<cron>" [--project <path>]');
    process.exit(2);
  }
  const { installRoutinePlist } = await import('../lib/routines/launchd.js');
  const runnerPath = resolve(__dirname, 'polyforge-routine-runner.sh');
  const result = installRoutinePlist({ routineName: name, runnerPath, projectRoot, schedule });
  console.log(JSON.stringify(result, null, 2));
}

async function routinesUninstallPlist() {
  const name = process.argv[3];
  if (!name) {
    console.error('Usage: polyforge _routines-uninstall-plist <name>');
    process.exit(2);
  }
  const { uninstallRoutinePlist } = await import('../lib/routines/launchd.js');
  const result = uninstallRoutinePlist(name);
  console.log(JSON.stringify(result, null, 2));
}

function isSymlinkTo(linkPath, targetPath) {
  try {
    return readlinkSync(linkPath) === targetPath;
  } catch {
    return false;
  }
}

function isValidSkillName(name) {
  return /^[a-z0-9-]+$/.test(name) && !name.includes('..');
}

function safeUnlink(filepath) {
  try {
    const stat = lstatSync(filepath);
    if (stat.isSymbolicLink() || stat.isFile()) {
      unlinkSync(filepath);
      return true;
    }
  } catch {
    // skip
  }
  return false;
}
