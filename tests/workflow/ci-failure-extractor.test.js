import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFailingCommand, shouldLearn, DEFAULT_EXCLUDE_PATTERNS } from '../../lib/ci-failure-extractor.js';

describe('extractFailingCommand', () => {
  it('returns null on empty input', () => {
    assert.equal(extractFailingCommand(''), null);
    assert.equal(extractFailingCommand(null), null);
  });

  it('extracts the last Run group before an error', () => {
    const log = `##[group]Run npm ci
npm ci
##[endgroup]
... success ...
##[group]Run npm run build:strict
npm run build:strict
##[endgroup]
error TS2322: Type mismatch
##[error]Process completed with exit code 1.`;
    assert.equal(extractFailingCommand(log), 'npm run build:strict');
  });

  it('returns the last run command when error has no immediate Run group', () => {
    const log = `##[group]Run npm test
npm test
##[endgroup]
some output
##[error]Process failed.`;
    assert.equal(extractFailingCommand(log), 'npm test');
  });

  it('trims whitespace', () => {
    const log = `##[group]Run    pytest -v
pytest -v
##[endgroup]
##[error]Failed.`;
    assert.equal(extractFailingCommand(log), 'pytest -v');
  });
});

describe('shouldLearn', () => {
  it('excludes deploy', () => {
    assert.equal(shouldLearn('deploy production'), false);
  });

  it('excludes release and publish', () => {
    assert.equal(shouldLearn('release create v1'), false);
    assert.equal(shouldLearn('npm publish'), false);
  });

  it('excludes docker push and gh release', () => {
    assert.equal(shouldLearn('docker push myimage'), false);
    assert.equal(shouldLearn('gh release create'), false);
  });

  it('accepts normal test/lint commands', () => {
    assert.equal(shouldLearn('npm test'), true);
    assert.equal(shouldLearn('npm run lint:strict'), true);
    assert.equal(shouldLearn('pytest -v'), true);
    assert.equal(shouldLearn('go test ./...'), true);
  });

  it('respects user excludePatterns', () => {
    assert.equal(shouldLearn('my-custom-deploy', ['my-custom-deploy']), false);
  });

  it('returns false for empty command', () => {
    assert.equal(shouldLearn(''), false);
    assert.equal(shouldLearn('  '), false);
  });

  it('DEFAULT_EXCLUDE_PATTERNS includes key server-only patterns', () => {
    assert.ok(DEFAULT_EXCLUDE_PATTERNS.includes('^deploy'));
    assert.ok(DEFAULT_EXCLUDE_PATTERNS.includes('uses:'));
  });
});
