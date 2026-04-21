import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseWorkflows } from '../../lib/workflow-parser.js';

let root;

before(() => {
  root = mkdtempSync(join(tmpdir(), 'polyforge-wf-'));
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('parseWorkflows', () => {
  it('returns empty when .github/workflows missing', () => {
    const empty = mkdtempSync(join(tmpdir(), 'polyforge-wf-empty-'));
    const result = parseWorkflows(empty);
    assert.deepEqual(result.commands, []);
    assert.equal(result.sourceHash, null);
    rmSync(empty, { recursive: true, force: true });
  });

  it('extracts run: commands from pull_request-triggered workflow', () => {
    const yaml = `name: CI
on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm test
`;
    writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), yaml);
    const result = parseWorkflows(root, { defaultBranch: 'main' });
    const cmds = result.commands.map(c => c.cmd);
    assert.ok(cmds.includes('npm run lint'), `expected lint, got ${JSON.stringify(cmds)}`);
    assert.ok(cmds.includes('npm test'));
    assert.ok(result.sourceHash && result.sourceHash.startsWith('sha256:'));
  });

  it('skips jobs triggered only by schedule or workflow_dispatch', () => {
    const yaml = `name: Nightly
on:
  schedule:
    - cron: '0 0 * * *'

jobs:
  deploy:
    steps:
      - run: make deploy
`;
    writeFileSync(join(root, '.github', 'workflows', 'nightly.yml'), yaml);
    const result = parseWorkflows(root, { defaultBranch: 'main' });
    const cmds = result.commands.map(c => c.cmd);
    assert.ok(!cmds.includes('make deploy'), `nightly should be skipped, got ${JSON.stringify(cmds)}`);
  });

  it('matches push jobs only for default branch', () => {
    const yaml = `name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    steps:
      - run: make deploy-prod
`;
    writeFileSync(join(root, '.github', 'workflows', 'deploy.yml'), yaml);
    const result = parseWorkflows(root, { defaultBranch: 'main' });
    const cmds = result.commands.map(c => c.cmd);
    assert.ok(cmds.includes('make deploy-prod'));
  });

  it('flags third-party uses: as warnings', () => {
    const yaml = `name: Security
on:
  pull_request:

jobs:
  scan:
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
      - run: echo done
`;
    writeFileSync(join(root, '.github', 'workflows', 'security.yml'), yaml);
    const result = parseWorkflows(root, { defaultBranch: 'main' });
    const warnedActions = result.warnings.filter(w => w.type === 'third-party-action').map(w => w.action);
    assert.ok(warnedActions.some(a => a.includes('snyk/actions/node')), `expected snyk warning, got ${JSON.stringify(warnedActions)}`);
    assert.ok(!warnedActions.some(a => a.startsWith('actions/checkout')), 'checkout should be ignorable');
  });
});
