import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DETECTORS = [
  {
    file: 'package.json',
    commands: [
      { name: 'test', cmd: 'npm test', blocking: true },
      { name: 'lint', cmd: 'npm run lint --if-present', blocking: false },
    ],
  },
  {
    file: 'composer.json',
    commands: [
      { name: 'test', cmd: 'composer test', blocking: true },
    ],
  },
  {
    file: 'go.mod',
    commands: [
      { name: 'test', cmd: 'go test ./...', blocking: true },
      { name: 'vet', cmd: 'go vet ./...', blocking: true },
    ],
  },
  {
    file: 'pyproject.toml',
    commands: [
      { name: 'test', cmd: 'python -m pytest', blocking: true },
    ],
  },
  {
    file: 'requirements.txt',
    commands: [
      { name: 'test', cmd: 'python -m pytest', blocking: true },
    ],
  },
  {
    file: 'Gemfile',
    commands: [
      { name: 'test', cmd: 'bundle exec rspec', blocking: true },
    ],
  },
  {
    file: 'Cargo.toml',
    commands: [
      { name: 'test', cmd: 'cargo test', blocking: true },
      { name: 'clippy', cmd: 'cargo clippy -- -D warnings', blocking: true },
    ],
  },
];

export function detectFallbackCommands(projectRoot) {
  const commands = [];
  const detected = [];
  for (const d of DETECTORS) {
    if (existsSync(resolve(projectRoot, d.file))) {
      detected.push(d.file);
      for (const c of d.commands) {
        if (!commands.some(x => x.cmd === c.cmd)) {
          commands.push({ ...c, origin: 'fallback-detect', detectedFrom: d.file });
        }
      }
    }
  }
  return { commands, detected };
}
