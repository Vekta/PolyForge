import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseWorkflows } from './workflow-parser.js';
import { atomicWriteConfig } from './config/migrator.js';

export function syncIfNeeded(projectRoot, { defaultBranch = 'main' } = {}) {
  const configPath = resolve(projectRoot, 'polyforge.json');
  if (!existsSync(configPath)) {
    return { synced: false, reason: 'no-polyforge-json' };
  }
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const currentHash = config?.pipeline?.ciMirror?.sourceHash || null;

  const parsed = parseWorkflows(projectRoot, { defaultBranch });
  const parsedHash = parsed.sourceHash;

  if (currentHash === parsedHash) {
    return { synced: false, reason: 'unchanged', hash: currentHash };
  }

  const next = structuredClone(config);
  next.pipeline = next.pipeline || {};
  next.pipeline.ciMirror = next.pipeline.ciMirror || {};
  next.pipeline.ciMirror.source = parsed.sources[0] || null;
  next.pipeline.ciMirror.sourceHash = parsedHash;
  next.pipeline.ciMirror.commands = parsed.commands;
  next.pipeline.ciMirror.triggerFilter = ['pull_request', 'push_default'];
  if (!next.pipeline.ciMirror.learnedCommands) next.pipeline.ciMirror.learnedCommands = [];
  if (!next.pipeline.ciMirror.excludePatterns) {
    next.pipeline.ciMirror.excludePatterns = ['^deploy', '^release', '^npm publish', '^docker push', '^gh release'];
  }
  if (!next.pipeline.ciMirror.learningConsent) next.pipeline.ciMirror.learningConsent = 'unasked';
  next.pipeline.ciMirror.lastSyncedAt = new Date().toISOString();

  atomicWriteConfig(projectRoot, next);
  return { synced: true, previousHash: currentHash, newHash: parsedHash, commands: parsed.commands.length, warnings: parsed.warnings };
}
