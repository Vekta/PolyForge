import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cpus } from 'node:os';

const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
const COMPOSE_GLOB_PREFIX = 'docker-compose.';
const DEV_SERVER_SCRIPT_PATTERNS = /^(dev|start|serve|server|run|watch)(:.*)?$/i;

export function detectParallelism(projectRoot) {
  const reasons = [];
  const detectedServices = [];

  const composeFiles = findComposeFiles(projectRoot);
  if (composeFiles.length > 0) {
    const services = extractComposeServices(projectRoot, composeFiles);
    if (services.length > 0) {
      detectedServices.push(...services.map(s => ({ type: 'docker-compose', ...s })));
      reasons.push(`docker-compose detected: ${services.map(s => s.name).join(', ')}`);
    }
  }

  const pkgJson = readJson(resolve(projectRoot, 'package.json'));
  if (pkgJson?.scripts) {
    const devScripts = Object.keys(pkgJson.scripts).filter(k => DEV_SERVER_SCRIPT_PATTERNS.test(k));
    if (devScripts.length > 0) {
      detectedServices.push({ type: 'npm-script', names: devScripts });
      reasons.push(`dev-server scripts: ${devScripts.join(', ')}`);
    }
  }

  const envPath = resolve(projectRoot, '.env.example');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    const portMatches = [...content.matchAll(/^([A-Z_]*PORT[A-Z_]*)=(\d+)/gm)];
    if (portMatches.length > 0) {
      detectedServices.push({ type: 'env-ports', ports: portMatches.map(m => ({ name: m[1], port: Number(m[2]) })) });
      reasons.push(`fixed ports in .env.example: ${portMatches.map(m => m[2]).join(', ')}`);
    }
  }

  const pnpmWarning = checkPnpmVersion(projectRoot);

  const suggestedMode = detectedServices.length > 0 ? 'serialized' : 'full';
  const suggestedMaxConcurrent = Math.max(1, Math.min(3, Math.floor(cpus().length / 2)));

  return {
    suggestedMode,
    suggestedMaxConcurrent,
    detectedServices,
    reasons,
    pnpmWarning,
  };
}

function findComposeFiles(projectRoot) {
  const out = [];
  for (const f of COMPOSE_FILES) {
    const p = resolve(projectRoot, f);
    if (existsSync(p)) out.push(f);
  }
  try {
    const entries = readdirSync(projectRoot);
    for (const e of entries) {
      if (e.startsWith(COMPOSE_GLOB_PREFIX) && /\.ya?ml$/.test(e) && !COMPOSE_FILES.includes(e)) {
        out.push(e);
      }
    }
  } catch {}
  return out;
}

function extractComposeServices(projectRoot, files) {
  const services = [];
  for (const f of files) {
    try {
      const content = readFileSync(resolve(projectRoot, f), 'utf-8');
      const servicesBlock = content.match(/^services:\s*\n([\s\S]*?)(?=\n\w+:|$)/m);
      if (!servicesBlock) continue;
      const serviceNames = [...servicesBlock[1].matchAll(/^  ([a-zA-Z0-9_-]+):/gm)].map(m => m[1]);
      const portMatches = [...content.matchAll(/(\d+):\d+/g)];
      for (const name of serviceNames) {
        services.push({ name, file: f, ports: portMatches.map(m => Number(m[1])) });
      }
    } catch {}
  }
  return services;
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}

function checkPnpmVersion(projectRoot) {
  const hasPnpmLock = existsSync(resolve(projectRoot, 'pnpm-lock.yaml'));
  if (!hasPnpmLock) return null;
  try {
    const v = execFileSync('pnpm', ['--version'], { encoding: 'utf-8', timeout: 3000 }).trim();
    const major = Number(v.split('.')[0]);
    if (Number.isFinite(major) && major < 9) {
      return {
        version: v,
        major,
        message: `pnpm ${v} detected. Parallel worktrees may collide on shared store. Recommend upgrade to pnpm 9+ or force parallelism.mode="serialized".`,
      };
    }
    return null;
  } catch {
    return null;
  }
}
