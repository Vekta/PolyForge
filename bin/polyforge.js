#!/usr/bin/env node

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, symlinkSync, readlinkSync, unlinkSync, readFileSync, readdirSync, statSync, lstatSync } from 'fs';
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
  '_routine-run': routineRun,
  '_routines-status': routinesStatus,
  '_routines-cleanup': routinesCleanup,
};

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

After install, use these slash commands in Claude Code:
  /forge            Scan & configure current project
  /review          Review a PR, issue, or Jira ticket
  /analyse-db      Analyze database schema
  /analyse-code    Full codebase analysis
  /report-issue    Detect & report issues
  /fix             Fix a specific issue
  /fix-ci          Diagnose & fix CI failures (max 3 retries)
  /brainstorm      Brainstorm a feature or fix
  /generate-doc    Generate Claude-optimized documentation
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
