import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateRoutinesConfig } from './schema.js';

export function loadConfig(projectRoot) {
  const path = resolve(projectRoot, 'polyforge.json');
  if (!existsSync(path)) {
    throw new Error(`polyforge.json not found at ${path}. Run /forge first.`);
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function loadRoutinesConfig(projectRoot) {
  const full = loadConfig(projectRoot);
  if (!full.routines) {
    throw new Error('No routines section in polyforge.json. Run /polyforge-routines-init first.');
  }
  const { valid, errors } = validateRoutinesConfig(full.routines);
  if (!valid) {
    throw new Error(`Invalid routines config:\n  - ${errors.join('\n  - ')}`);
  }
  return full.routines;
}

export function writeRoutinesConfig(projectRoot, routinesSection) {
  const { valid, errors } = validateRoutinesConfig(routinesSection);
  if (!valid) {
    throw new Error(`Cannot write invalid config:\n  - ${errors.join('\n  - ')}`);
  }
  const path = resolve(projectRoot, 'polyforge.json');
  const full = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : {};
  full.routines = routinesSection;
  writeFileSync(path, JSON.stringify(full, null, 2) + '\n');
}

export function findRoutine(config, name) {
  const r = config.routines.find(x => x.name === name);
  if (!r) throw new Error(`Routine "${name}" not found in config`);
  return r;
}

export function updateRoutine(projectRoot, name, patch) {
  const cfg = loadRoutinesConfig(projectRoot);
  const idx = cfg.routines.findIndex(r => r.name === name);
  if (idx === -1) throw new Error(`Routine "${name}" not found`);
  cfg.routines[idx] = { ...cfg.routines[idx], ...patch };
  writeRoutinesConfig(projectRoot, cfg);
  return cfg.routines[idx];
}
