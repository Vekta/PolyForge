const WORKTREE_FS = ['Bash(ln:*)', 'Bash(rm:*)', 'Bash(mkdir:*)', 'Bash(touch:*)'];

const STACK_PATTERNS = {
  php: ['Bash(composer:*)', 'Bash(php:*)'],
  javascript: ['Bash(npm:*)', 'Bash(npx:*)', 'Bash(node:*)'],
  typescript: ['Bash(npm:*)', 'Bash(npx:*)', 'Bash(node:*)'],
  python: ['Bash(python:*)', 'Bash(python3:*)', 'Bash(pip:*)', 'Bash(pytest:*)'],
  go: ['Bash(go:*)'],
  ruby: ['Bash(bundle:*)', 'Bash(rake:*)'],
  rust: ['Bash(cargo:*)'],
};

const PACKAGE_MANAGER_PATTERNS = {
  npm: ['Bash(npm:*)', 'Bash(npx:*)'],
  pnpm: ['Bash(pnpm:*)', 'Bash(npx:*)'],
  yarn: ['Bash(yarn:*)', 'Bash(npx:*)'],
  composer: ['Bash(composer:*)'],
  pip: ['Bash(pip:*)', 'Bash(python:*)'],
  poetry: ['Bash(poetry:*)', 'Bash(python:*)'],
  bundler: ['Bash(bundle:*)'],
  cargo: ['Bash(cargo:*)'],
  go: ['Bash(go:*)'],
};

const DOCKER_PATTERNS = ['Bash(docker:*)', 'Bash(docker-compose:*)'];

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export function recommendedAllowlist(detection = {}) {
  const patterns = new Set(WORKTREE_FS);

  const stack = Array.isArray(detection.stack) ? detection.stack : [];
  for (const lang of stack) {
    const list = STACK_PATTERNS[normalize(lang)];
    if (list) list.forEach(p => patterns.add(p));
  }

  const pmList = PACKAGE_MANAGER_PATTERNS[normalize(detection.packageManager)];
  if (pmList) pmList.forEach(p => patterns.add(p));

  const usesDocker = Boolean(detection.database?.containerName) ||
    normalize(detection.database?.connectionMethod) === 'docker';
  if (usesDocker) DOCKER_PATTERNS.forEach(p => patterns.add(p));

  return [...patterns].sort();
}

export function mergeIntoSettings(existing = {}, patterns = []) {
  const base = existing && typeof existing === 'object' ? existing : {};
  const permissions = base.permissions && typeof base.permissions === 'object' ? base.permissions : {};
  const currentAllow = Array.isArray(permissions.allow) ? permissions.allow : [];

  const merged = [...currentAllow];
  for (const p of patterns) {
    if (!merged.includes(p)) merged.push(p);
  }

  return {
    ...base,
    permissions: {
      ...permissions,
      allow: merged,
    },
  };
}
