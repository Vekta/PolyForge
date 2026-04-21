import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTicketList } from '../../lib/parallel-orchestrator.js';

describe('parseTicketList', () => {
  it('parses GitHub issue numbers', () => {
    const r = parseTicketList(['#10', '#11', '#12']);
    assert.equal(r.length, 3);
    assert.equal(r[0].type, 'github');
    assert.equal(r[0].number, 10);
  });

  it('parses Jira keys', () => {
    const r = parseTicketList(['POLY-123', 'DEV-42']);
    assert.equal(r.length, 2);
    assert.equal(r[0].type, 'jira');
    assert.equal(r[0].key, 'POLY-123');
    assert.equal(r[0].number, 123);
  });

  it('ignores non-ticket args', () => {
    const r = parseTicketList(['#10', '--auto', 'not-a-ticket', 'DEV-5']);
    assert.equal(r.length, 2);
    assert.equal(r[0].type, 'github');
    assert.equal(r[1].type, 'jira');
  });

  it('returns empty for no tickets', () => {
    assert.deepEqual(parseTicketList([]), []);
  });

  it('rejects lowercase Jira keys (by convention)', () => {
    const r = parseTicketList(['poly-123', 'DEV-5']);
    assert.equal(r.length, 1);
    assert.equal(r[0].key, 'DEV-5');
  });
});
