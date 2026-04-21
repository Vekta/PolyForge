import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const WORKFLOWS_DIR = '.github/workflows';
const LOCAL_ACTIONS_PREFIX = './.github/actions/';

export function parseWorkflows(projectRoot, { defaultBranch = 'main' } = {}) {
  const dir = resolve(projectRoot, WORKFLOWS_DIR);
  if (!existsSync(dir)) {
    return { commands: [], warnings: [], sourceHash: null, sources: [] };
  }

  const files = readdirSync(dir).filter(f => /\.ya?ml$/i.test(f));
  const commands = [];
  const warnings = [];
  const sources = [];

  for (const file of files) {
    const path = resolve(dir, file);
    const content = readFileSync(path, 'utf-8');
    const relevant = isTriggerRelevant(content, defaultBranch);
    if (!relevant) continue;
    sources.push(`${WORKFLOWS_DIR}/${file}`);
    const extracted = extractFromYaml(content, projectRoot, new Set([path]));
    for (const cmd of extracted.commands) {
      commands.push({ ...cmd, source: `${WORKFLOWS_DIR}/${file}` });
    }
    for (const w of extracted.warnings) {
      warnings.push({ ...w, source: `${WORKFLOWS_DIR}/${file}` });
    }
  }

  const sourceHash = hashSources(projectRoot, sources);
  return { commands, warnings, sourceHash, sources };
}

function isTriggerRelevant(yaml, defaultBranch) {
  const onMatch = yaml.match(/^on:\s*([\s\S]*?)^(?:\w|$)/m);
  const onBlock = onMatch ? onMatch[1] : yaml;
  if (/^\s*pull_request\s*:/m.test(onBlock) || /^\s*pull_request\s*$/m.test(onBlock)) return true;
  const pushMatch = onBlock.match(/^\s*push\s*:\s*([\s\S]*?)(?=^\s*\w+\s*:|$)/m);
  if (pushMatch) {
    const pushBlock = pushMatch[1];
    if (new RegExp(`branches:\\s*\\[[^\\]]*["']?${escapeRegex(defaultBranch)}["']?`).test(pushBlock)) return true;
    if (new RegExp(`-\\s*["']?${escapeRegex(defaultBranch)}["']?`).test(pushBlock)) return true;
  }
  return false;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractFromYaml(content, projectRoot, seen) {
  const commands = [];
  const warnings = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const runMatch = lines[i].match(/^\s*(?:-\s*)?run:\s*(.+)$/);
    if (runMatch) {
      const cmd = extractMultilineRun(lines, i, runMatch[1]);
      if (cmd) {
        const name = findAdjacentName(lines, i);
        commands.push({
          name: name || cmd.split(/\s+/)[0],
          cmd,
          blocking: true,
          origin: 'workflow',
        });
      }
      continue;
    }
    const usesMatch = lines[i].match(/^\s*(?:-\s*)?uses:\s*(.+)$/);
    if (usesMatch) {
      const uses = usesMatch[1].trim().replace(/^["']|["']$/g, '').replace(/\s*#.*$/, '');
      if (uses.startsWith(LOCAL_ACTIONS_PREFIX)) {
        const localPath = resolveLocalAction(projectRoot, uses);
        if (localPath && !seen.has(localPath)) {
          seen.add(localPath);
          try {
            const inner = readFileSync(localPath, 'utf-8');
            const nested = extractFromYaml(inner, projectRoot, seen);
            commands.push(...nested.commands);
            warnings.push(...nested.warnings);
          } catch {
            warnings.push({ type: 'local-action-read-failed', action: uses });
          }
        }
      } else if (!isIgnorableThirdParty(uses)) {
        warnings.push({ type: 'third-party-action', action: uses });
      }
    }
  }
  return { commands, warnings };
}

function extractMultilineRun(lines, i, firstLine) {
  const first = firstLine.trim();
  if (first === '|' || first === '>' || first === '|-' || first === '>-' || first === '|+' || first === '>+') {
    const parts = [];
    const baseIndent = lines[i].match(/^(\s*)/)[1].length;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === '') continue;
      const indent = l.match(/^(\s*)/)[1].length;
      if (indent <= baseIndent) break;
      parts.push(l.trim());
    }
    return parts.join(' && ');
  }
  return first.replace(/^["']|["']$/g, '');
}

function findAdjacentName(lines, runIdx) {
  for (let j = runIdx - 1; j >= 0 && j >= runIdx - 2; j--) {
    const m = lines[j].match(/^\s*(?:-\s*)?name:\s*(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    if (lines[j].trim() === '') continue;
    if (lines[j].match(/^\s*-\s/)) break;
  }
  return undefined;
}

function resolveLocalAction(projectRoot, uses) {
  const rel = uses.replace(/^\.\//, '');
  for (const filename of ['action.yml', 'action.yaml']) {
    const candidate = resolve(projectRoot, rel, filename);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const IGNORABLE_PREFIXES = [
  'actions/checkout',
  'actions/setup-',
  'actions/cache',
  'actions/upload-artifact',
  'actions/download-artifact',
];

function isIgnorableThirdParty(uses) {
  return IGNORABLE_PREFIXES.some(p => uses.startsWith(p));
}

function hashSources(projectRoot, sources) {
  const hash = createHash('sha256');
  for (const s of sources.sort()) {
    try { hash.update(readFileSync(resolve(projectRoot, s))); } catch {}
  }
  return 'sha256:' + hash.digest('hex').slice(0, 24);
}

export { LOCAL_ACTIONS_PREFIX, IGNORABLE_PREFIXES };
