import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRoutinesConfig, writeRoutinesConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const SCAFFOLDS = {
  scan: {
    file: 'scan.md',
    required: ['ROUTINE_NAME', 'SCAN_TARGET', 'SCAN_COMMAND', 'MAX_TURNS'],
    defaults: { autonomy: 'suggest', system_prompt_strategy: 'minimal' },
  },
  fix: {
    file: 'fix.md',
    required: ['ROUTINE_NAME', 'FIX_TARGET', 'DETECT_COMMAND', 'AREA', 'AUTONOMY_LABEL', 'AUTO_MERGE_CONDITIONS', 'AUTO_MERGE_ALLOWLIST', 'MODEL', 'MAX_TURNS'],
    defaults: { autonomy: 'pr-review', system_prompt_strategy: 'targeted' },
  },
  review: {
    file: 'review.md',
    required: ['ROUTINE_NAME', 'REVIEW_TARGET', 'LIST_COMMAND', 'TYPE', 'REVIEW_CHECKLIST', 'ALLOWLIST', 'MODEL'],
    defaults: { autonomy: 'mixed', system_prompt_strategy: 'targeted' },
  },
  report: {
    file: 'report.md',
    required: ['ROUTINE_NAME', 'REPORT_SOURCES', 'SOURCE_LIST', 'GROUPING_DIMENSION', 'MAX_TURNS'],
    defaults: { autonomy: 'suggest', system_prompt_strategy: 'minimal' },
  },
};

export function generateRoutine({ projectRoot, scaffoldType, answers }) {
  const scaffold = SCAFFOLDS[scaffoldType];
  if (!scaffold) throw new Error(`Unknown scaffold: ${scaffoldType}. Valid: ${Object.keys(SCAFFOLDS).join(', ')}`);

  for (const key of scaffold.required) {
    if (!answers[key] && key !== 'MAX_TURNS') {
      throw new Error(`Missing required answer: ${key}`);
    }
  }

  const templatePath = resolve(ROOT, 'templates', 'routines', '_scaffolds', scaffold.file);
  if (!existsSync(templatePath)) throw new Error(`Scaffold template missing: ${templatePath}`);
  const template = readFileSync(templatePath, 'utf-8');
  const filled = fillPlaceholders(template, {
    ...answers,
    MAX_TURNS: answers.MAX_TURNS || 15,
  });

  const routineName = answers.ROUTINE_NAME;
  const outDir = resolve(projectRoot, 'templates', 'routines', routineName);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const promptPath = resolve(outDir, 'prompt.md');
  writeFileSync(promptPath, filled);

  const routineConfig = {
    name: routineName,
    enabled: true,
    first_run_dry: true,
    schedule: answers.schedule || '0 2 * * *',
    template: `custom:${routineName}`,
    model: answers.model || 'haiku',
    max_turns: Number(answers.MAX_TURNS) || 15,
    allowed_tools: answers.allowed_tools || ['Read', 'Bash(git *)', 'Bash(gh *)'],
    ...scaffold.defaults,
  };

  const full = loadRoutinesConfig(projectRoot);
  const existingIdx = full.routines.findIndex(r => r.name === routineName);
  if (existingIdx >= 0) full.routines[existingIdx] = routineConfig;
  else full.routines.push(routineConfig);
  writeRoutinesConfig(projectRoot, full);

  return { promptPath, routineConfig };
}

function fillPlaceholders(str, vars) {
  return str.replace(/\{([A-Z_]+)\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
}
