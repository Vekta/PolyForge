import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';

const HEADER = `# Routine system prompt
Generated automatically — do not edit.
`;

export function buildSystemPrompt(projectRoot, routine) {
  const strategy = routine.system_prompt_strategy;
  const outDir = resolve(homedir(), '.polyforge', 'prompts');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${routine.name}.md`);

  switch (strategy) {
    case 'full':
      return { mode: 'full', bare: false, file: null };

    case 'targeted': {
      const sources = routine.system_prompt_sources || [];
      const parts = [HEADER, `## Role: ${routine.name}\n`];
      for (const src of sources) {
        const p = resolve(projectRoot, src);
        if (existsSync(p)) {
          parts.push(`\n---\n## Source: ${src}\n\n${readFileSync(p, 'utf-8')}\n`);
        } else {
          parts.push(`\n---\n## Source: ${src} (NOT FOUND — skipped)\n`);
        }
      }
      writeFileSync(outPath, parts.join('\n'));
      return { mode: 'targeted', bare: true, file: outPath };
    }

    case 'minimal': {
      const content = [
        HEADER,
        `## Role: ${routine.name}`,
        `Template: ${routine.template}`,
        `Max turns: ${routine.max_turns}`,
        `Autonomy: ${routine.autonomy}`,
        routine.pr_policy ? `PR policy: ${JSON.stringify(routine.pr_policy)}` : '',
        routine.auto_merge_allowlist ? `Auto-merge allowlist: ${routine.auto_merge_allowlist.join(', ')}` : '',
        `\nRun within the git worktree you are invoked in. Respect all allowed_tools boundaries.`,
      ].filter(Boolean).join('\n');
      writeFileSync(outPath, content);
      return { mode: 'minimal', bare: true, file: outPath };
    }

    default:
      throw new Error(`Unknown system_prompt_strategy: ${strategy}`);
  }
}
