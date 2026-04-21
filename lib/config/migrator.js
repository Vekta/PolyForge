import { writeFileSync, existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { CONFIG_VERSION } from './schema.js';

const DEAD_PIPELINE_FIELDS = ['preCommit', 'prePush', 'prePR'];

export function detectNeededMigrations(config) {
  const migrations = [];
  const atCurrent = config.schemaVersion === CONFIG_VERSION;
  if (atCurrent) return migrations;

  if (config.pipeline) {
    const deadFound = DEAD_PIPELINE_FIELDS.filter(f => f in config.pipeline);
    if (deadFound.length > 0) {
      migrations.push({
        id: 'remove-dead-pipeline-fields',
        description: `Remove dead pipeline fields: ${deadFound.join(', ')} (replaced by pipeline.ciMirror + runtime fallback)`,
        fields: deadFound,
      });
    }
  }
  if (!config.schemaVersion || config.schemaVersion !== CONFIG_VERSION) {
    migrations.push({
      id: 'set-schema-version',
      description: `Stamp config with schemaVersion "${CONFIG_VERSION}"`,
    });
  }
  return migrations;
}

export function applyMigrations(config, migrations) {
  const next = structuredClone(config);
  for (const m of migrations) {
    switch (m.id) {
      case 'remove-dead-pipeline-fields':
        for (const f of m.fields) delete next.pipeline[f];
        if (next.pipeline && Object.keys(next.pipeline).length === 0) delete next.pipeline;
        break;
      case 'set-schema-version':
        next.schemaVersion = CONFIG_VERSION;
        break;
      default:
        throw new Error(`Unknown migration: ${m.id}`);
    }
  }
  return next;
}

export function computeDiff(before, after) {
  const beforeStr = JSON.stringify(before, null, 2);
  const afterStr = JSON.stringify(after, null, 2);
  if (beforeStr === afterStr) return { changed: false, diff: '' };
  const beforeLines = beforeStr.split('\n');
  const afterLines = afterStr.split('\n');
  const out = [];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i++) {
    if (beforeLines[i] === afterLines[i]) continue;
    if (i < beforeLines.length) out.push(`- ${beforeLines[i]}`);
    if (i < afterLines.length) out.push(`+ ${afterLines[i]}`);
  }
  return { changed: true, diff: out.join('\n') };
}

export function assertConfigClean(projectRoot) {
  const path = resolve(projectRoot, 'polyforge.json');
  if (!existsSync(path)) return { clean: true, reason: 'no-config-yet' };
  try {
    const out = execFileSync('git', ['status', '--porcelain', 'polyforge.json'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (out.trim() === '') return { clean: true };
    return { clean: false, status: out.trim() };
  } catch {
    return { clean: true, reason: 'not-a-git-repo' };
  }
}

export function atomicWrite(path, content) {
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

export function atomicWriteConfig(projectRoot, config) {
  const path = resolve(projectRoot, 'polyforge.json');
  atomicWrite(path, JSON.stringify(config, null, 2) + '\n');
}

export { DEAD_PIPELINE_FIELDS };
