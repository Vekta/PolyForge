import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWorkPredicate } from '../../lib/routines/work-predicate.js';

function fakeExec(map) {
  return (file, args) => {
    const key = `${file} ${args.join(' ')}`;
    for (const [pattern, value] of Object.entries(map)) {
      if (key.includes(pattern)) {
        if (value instanceof Error) throw value;
        return value;
      }
    }
    throw new Error(`unexpected exec: ${key}`);
  };
}

describe('evaluateWorkPredicate', () => {
  it('treats a missing spec as always-has-work', () => {
    assert.equal(evaluateWorkPredicate(undefined).hasWork, true);
    assert.equal(evaluateWorkPredicate({ type: 'always' }).hasWork, true);
  });

  it('untriaged-issues: has work when at least one issue is returned', () => {
    const exec = fakeExec({ 'gh issue list': '[{"number":42}]' });
    assert.equal(evaluateWorkPredicate({ type: 'untriaged-issues' }, { exec }).hasWork, true);
  });

  it('untriaged-issues: no work when the list is empty', () => {
    const exec = fakeExec({ 'gh issue list': '[]' });
    assert.equal(evaluateWorkPredicate({ type: 'untriaged-issues' }, { exec }).hasWork, false);
  });

  it('open-prs: no work when there are no open PRs', () => {
    const exec = fakeExec({ 'gh pr list': '[]' });
    assert.equal(evaluateWorkPredicate({ type: 'open-prs' }, { exec }).hasWork, false);
  });

  it('commits-since-tag: has work when commits exist past the latest tag', () => {
    const exec = fakeExec({ 'git describe': 'v1.2.0\n', 'git rev-list': '4\n' });
    const r = evaluateWorkPredicate({ type: 'commits-since-tag' }, { exec });
    assert.equal(r.hasWork, true);
  });

  it('commits-since-tag: no work when the tag is at HEAD', () => {
    const exec = fakeExec({ 'git describe': 'v1.2.0\n', 'git rev-list': '0\n' });
    assert.equal(evaluateWorkPredicate({ type: 'commits-since-tag' }, { exec }).hasWork, false);
  });

  it('commits-since-tag: fails open when there are no tags', () => {
    const exec = fakeExec({ 'git describe': new Error('no tag'), 'git rev-list': '0\n' });
    assert.equal(evaluateWorkPredicate({ type: 'commits-since-tag' }, { exec }).hasWork, true);
  });

  it('recent-commits: no work when nothing landed in the window', () => {
    const exec = fakeExec({ 'git log': '' });
    assert.equal(evaluateWorkPredicate({ type: 'recent-commits', withinHours: 24 }, { exec }).hasWork, false);
  });

  it('recent-commits: has work when commits exist', () => {
    const exec = fakeExec({ 'git log': 'abc fix\ndef feat' });
    assert.equal(evaluateWorkPredicate({ type: 'recent-commits' }, { exec }).hasWork, true);
  });

  it('fails open (has work) when the command throws', () => {
    const exec = fakeExec({ 'gh issue list': new Error('gh not found') });
    const r = evaluateWorkPredicate({ type: 'untriaged-issues' }, { exec });
    assert.equal(r.hasWork, true);
    assert.match(r.reason, /predicate error/);
  });

  it('fails open on an unknown predicate type', () => {
    assert.equal(evaluateWorkPredicate({ type: 'mystery' }, { exec: fakeExec({}) }).hasWork, true);
  });
});
