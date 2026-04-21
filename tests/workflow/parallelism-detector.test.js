import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectParallelism } from '../../lib/parallelism-detector.js';

describe('detectParallelism', () => {
  it('suggests full mode on bare project', () => {
    const root = mkdtempSync(join(tmpdir(), 'polyforge-par-'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'bare', scripts: { test: 'node --test' } }));
    const result = detectParallelism(root);
    assert.equal(result.suggestedMode, 'full');
    assert.ok(result.suggestedMaxConcurrent >= 1);
    rmSync(root, { recursive: true, force: true });
  });

  it('suggests serialized when docker-compose present', () => {
    const root = mkdtempSync(join(tmpdir(), 'polyforge-par-'));
    writeFileSync(join(root, 'docker-compose.yml'), `services:
  db:
    image: postgres:15
    ports:
      - "5432:5432"
  cache:
    image: redis:7
    ports:
      - "6379:6379"
`);
    const result = detectParallelism(root);
    assert.equal(result.suggestedMode, 'serialized');
    assert.ok(result.detectedServices.some(s => s.type === 'docker-compose'));
    assert.ok(result.reasons.some(r => r.includes('docker-compose')));
    rmSync(root, { recursive: true, force: true });
  });

  it('detects dev scripts in package.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'polyforge-par-'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'app',
      scripts: { dev: 'next dev', start: 'next start', test: 'jest' },
    }));
    const result = detectParallelism(root);
    assert.ok(result.detectedServices.some(s => s.type === 'npm-script'));
    assert.equal(result.suggestedMode, 'serialized');
    rmSync(root, { recursive: true, force: true });
  });

  it('detects fixed ports in .env.example', () => {
    const root = mkdtempSync(join(tmpdir(), 'polyforge-par-'));
    writeFileSync(join(root, '.env.example'), `PORT=3000
DB_PORT=5432
REDIS_PORT=6379
`);
    const result = detectParallelism(root);
    assert.ok(result.detectedServices.some(s => s.type === 'env-ports'));
    assert.equal(result.suggestedMode, 'serialized');
    rmSync(root, { recursive: true, force: true });
  });

  it('caps maxConcurrent at 3', () => {
    const root = mkdtempSync(join(tmpdir(), 'polyforge-par-'));
    const result = detectParallelism(root);
    assert.ok(result.suggestedMaxConcurrent <= 3);
    assert.ok(result.suggestedMaxConcurrent >= 1);
    rmSync(root, { recursive: true, force: true });
  });
});
