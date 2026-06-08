import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, rmSync, readlinkSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '..', 'bin', 'polyforge.js');
const ROOT = resolve(__dirname, '..');

function run(args = []) {
  return execFileSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, HOME: process.env.HOME },
  });
}

describe('polyforge CLI', () => {
  it('shows help with no arguments', () => {
    const output = run();
    assert.match(output, /PolyForge/);
    assert.match(output, /install/);
    assert.match(output, /uninstall/);
  });

  it('shows help with "help" command', () => {
    const output = run(['help']);
    assert.match(output, /Usage/);
    assert.match(output, /\/forge/);
    assert.match(output, /\/hallmark/);
    assert.match(output, /\/smith/);
    assert.match(output, /\/sketch/);
    assert.match(output, /\/embers/);
  });

  it('rejects unknown commands', () => {
    assert.throws(() => run(['foobar']), /Unknown command/);
  });

  it('shows version with --version', () => {
    const output = run(['--version']);
    assert.match(output, /polyforge v\d+\.\d+\.\d+/);
  });

  it('shows version with -v', () => {
    const output = run(['-v']);
    assert.match(output, /polyforge v\d+\.\d+\.\d+/);
  });

  it('exits with error for add-skill without arguments', () => {
    assert.throws(() => run(['add-skill']), /add-skill/);
  });

  it('exits with error for remove-skill without arguments', () => {
    assert.throws(() => run(['remove-skill']), /remove-skill/);
  });

  it('lists available skills', () => {
    const output = run(['list']);
    assert.match(output, /init/);
    assert.match(output, /hallmark/);
    assert.match(output, /smith/);
    assert.match(output, /sketch/);
  });

  it('warns on unknown skill name in add-skill', () => {
    const output = run(['add-skill', 'nonexistent']);
    assert.match(output, /Unknown skill/);
  });
});

describe('skill files', () => {
  const skillDirs = ['init', 'hallmark', 'blueprint', 'mark', 'smith', 'quench', 'sketch', 'assay', 'engrave', 'fold', 'temper', 'probe', 'embers'];

  for (const skill of skillDirs) {
    it(`${skill}/SKILL.md exists`, () => {
      const skillPath = resolve(ROOT, 'skills', skill, 'SKILL.md');
      assert.ok(existsSync(skillPath), `Missing: skills/${skill}/SKILL.md`);
    });

    it(`${skill}/SKILL.md has valid frontmatter`, () => {
      const skillPath = resolve(ROOT, 'skills', skill, 'SKILL.md');
      const content = readFileSync(skillPath, 'utf-8');
      assert.match(content, /^---\n/, `${skill}: missing frontmatter opening`);
      assert.match(content, /name:\s*\S+/, `${skill}: missing name field`);
      assert.match(content, /description:\s*\S+/, `${skill}: missing description field`);
      assert.match(content, /Use when/, `${skill}: description should include trigger phrase "Use when"`);
    });
  }
});

describe('rule files', () => {
  const ruleFiles = ['golden-principles.md', 'security.md', 'testing.md'];

  for (const rule of ruleFiles) {
    it(`${rule} exists`, () => {
      const rulePath = resolve(ROOT, 'rules', rule);
      assert.ok(existsSync(rulePath), `Missing: rules/${rule}`);
    });
  }

  it('golden-principles.md forbids useless inline comments', () => {
    const content = readFileSync(resolve(ROOT, 'rules', 'golden-principles.md'), 'utf-8');
    assert.match(content, /inline `\/\/` comments/, 'should name the inline-comment anti-pattern');
    assert.match(content, /why.*never.*what/i, 'should state comments explain why, not what');
    assert.match(content, /doc-comment idiom/, 'should prefer the doc-comment idiom over inline chatter');
  });
});

describe('one ticket = one PR principle', () => {
  it('common-patterns.md declares the principle and the narrow exceptions', () => {
    const content = readFileSync(resolve(ROOT, 'skills', 'shared', 'common-patterns.md'), 'utf-8');
    assert.match(content, /One Ticket = One PR/, 'should declare the principle');
    assert.match(content, /commit boundaries, not PR boundaries/, 'phases map to commits');
    assert.match(content, /Narrow exceptions/, 'should define narrow exceptions');
    assert.match(content, /parallel mode is unaffected/i, 'should exempt multi-ticket parallel mode');
  });

  it('smith/SKILL.md references the one-ticket-one-PR principle', () => {
    const content = readFileSync(resolve(ROOT, 'skills', 'smith', 'SKILL.md'), 'utf-8');
    assert.match(content, /One ticket = one PR/i, 'smith should state the principle');
  });
});

describe('templates', () => {
  it('CLAUDE.md template exists', () => {
    assert.ok(existsSync(resolve(ROOT, 'templates', 'CLAUDE.md.template')));
  });

  it('config template exists', () => {
    assert.ok(existsSync(resolve(ROOT, 'templates', 'polyforge.config.json')));
  });
});
