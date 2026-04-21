import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function parseGitlabCI(projectRoot) {
  const path = resolve(projectRoot, '.gitlab-ci.yml');
  return {
    commands: [],
    warnings: existsSync(path) ? [{ type: 'gitlab-ci-stubbed', msg: 'GitLab CI parsing not yet implemented — contribute at github.com/Vekta/polyforge' }] : [],
    sourceHash: null,
    sources: [],
    unsupported: true,
  };
}
