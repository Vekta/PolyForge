# PolyForge Routines — Nocturnal Autonomous Workflows
> ⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge) on 2026-04-16

Système de routines autonomes **plan-aware** distribué avec PolyForge, qui exploite les quotas Claude inutilisés pendant la nuit pour faire avancer les projets des users pendant qu'ils dorment : triage d'issues, review de PR, refacto, maintenance des deps, grooming du backlog — avec adaptation automatique au plan d'abonnement et isolation stricte via git worktrees.

**Value prop** : « Ton Mac code, review et refacto pendant que tu dors, dans une fenêtre horaire que tu contrôles, avec le quota que tu aurais perdu. Le scope des routines s'adapte à ton plan Claude (Pro / Max / Team / Enterprise / API). »

Implémentation prévue en **un seul PR couvrant toutes les phases**.

---

## Pre-implementation validation (spikes live 2026-04-16)

Les décisions de design ci-dessous reposent sur des vérifications empiriques, pas sur des suppositions.

| Hypothèse | Résultat |
|---|---|
| `claude -p --output-format json` expose tokens + cost | ✅ JSON contient `total_cost_usd`, `usage.*`, `duration_ms`, `num_turns`, `modelUsage` |
| `claude -p` sans `--bare` utilise le keychain (héritable par launchd) | ✅ Auth transparente en subshell |
| `claude auth status` expose le plan de l'abonnement | ✅ Retourne `subscriptionType` + `authMethod` |
| `git worktree add -b` off `main` fonctionne même si main checkout ailleurs | ✅ Aucune collision |
| Slash commands PolyForge résolvent en mode `-p` | ✅ Doc `--bare` confirme "Skills still resolve via /skill-name" |
| `--max-budget-usd` halt sur auth subscription (pas que API key) | ✅ `subtype: "error_max_budget_usd"`, `errors: [...]` parseable |
| System prompt strategy mesurable | ✅ Cache creation ~40k (`full`) → ~1-5k (`minimal`) = -82% overhead |
| Valeurs `subscriptionType` énumérables a priori | ⚠️ Seule `team` confirmée ; autres plans = discover-as-you-go avec fallback |

**Observation cache** : cache read 27k tokens (au lieu de 41k cache creation initial) entre 2 runs espacés de ~30 min. Cache 5min-1h récompense les routines batched rapprochées → à exploiter.

---

## Plan-aware profiles

À l'init, PolyForge parse `claude auth status` et propose un profil adapté. Les quotas ne sont pas chiffrés ici (dépendent de la politique Anthropic qui évolue) — on raisonne en ordre de grandeur.

| `subscriptionType` | Capacité | Profil par défaut | Routines activées | Modèles |
|---|---|---|---|---|
| `pro` (à confirmer à l'install) | Tight | `light` | deps-security, release-notes (hebdo) | Haiku |
| `max` / `max_5x` (à confirmer) | Comfortable | `standard` | + backlog-groomer, refacto-scanner | Haiku + Sonnet |
| `max_20x` (à confirmer) | Large | `full` | + issue-worker, pr-reviewer | Sonnet |
| `team` ✅ | Very large | `unleashed` | Tout + custom illimité | Sonnet/Opus |
| `enterprise` (à confirmer) | Very large | `unleashed` | Idem team | Sonnet/Opus |
| `apiKey` | $ direct | `budget-driven` | User choisit, `--max-budget-usd` strict | User choisit |
| Inconnu / nouveau | Fallback | `standard` + warn + log | Mapping via AskUserQuestion | User choisit |

User peut toujours override le profil proposé.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│  User Mac (plugged + logged in, fenêtre 23h–07h TZ système)              │
│                                                                           │
│  launchd plist → StartCalendarInterval + ExitTimeOut                      │
│       │                                                                   │
│       ▼                                                                   │
│  bin/polyforge-routine-runner.sh {routine-name}                           │
│       │                                                                   │
│       ├─► preflight (inline, obligatoire même pour `run-now`)             │
│       │    ├─ kill-switch : ~/.polyforge/PAUSE existe ?                   │
│       │    ├─ plan : claude auth status JSON schema valide ?              │
│       │    ├─ window : now ∈ [start, end] TZ système                      │
│       │    ├─ rate-limit marker : ~/.polyforge/rate-limited-until.json    │
│       │    ├─ git fetch origin {base_branch} OK ?                         │
│       │    ├─ network (2x pings espacés) OK ?                             │
│       │    └─ disk space > 500MB OK ?                                     │
│       │                                                                   │
│       ├─► serial lock global : flock sur ~/.polyforge/routines/.lock      │
│       │                                                                   │
│       ├─► git worktree add -b routine/{name}/{timestamp}                  │
│       │    {worktree_root}/{project-hash}/{name}/{timestamp}              │
│       │    origin/{base_branch}                                           │
│       │                                                                   │
│       ├─► construire system prompt selon strategy                         │
│       │    ├─ full       → pas de --append, claude charge CLAUDE.md       │
│       │    ├─ targeted   → --bare + fichier généré depuis sources listées │
│       │    └─ minimal    → --bare + prompt court inline                   │
│       │                                                                   │
│       ├─► claude -p                                                       │
│       │     --output-format json                                          │
│       │     --model {selon profil et routine}                             │
│       │     --max-budget-usd {selon profil, TOUS les users}               │
│       │     --max-turns {selon routine}                                   │
│       │     --permission-mode bypassPermissions                           │
│       │     --allowedTools {explicite par routine}                        │
│       │     [--append-system-prompt-file ...] | [--bare ...]              │
│       │     -- "prompt de la routine"                                     │
│       │                                                                   │
│       ├─► parse JSON → append ~/.polyforge/logs/{name}.jsonl              │
│       │                                                                   │
│       ├─► si subtype=error_max_budget_usd → log, skip reste du run        │
│       ├─► si api_error_status=rate_limit → écrire marker, stop            │
│       │                                                                   │
│       ├─► gh pr create (label selon autonomy + allowlist match)           │
│       │    wrapper avec retry exponential backoff (3 max)                 │
│       │                                                                   │
│       └─► release lock, garde le worktree (cleanup séparé)                │
│                                                                           │
│  Daily reporter (schedule: {window.end} + 15min)                          │
│    - Agrège JSONL de la nuit → markdown                                   │
│    - Poste en issue GH ou Slack webhook                                   │
│                                                                           │
│  Cleanup daemon (schedule: {window.end} + 1h, 1x/jour)                    │
│    - Scan worktrees routine/*                                             │
│    - Check PR status via gh                                               │
│    - git worktree remove si PR closed/merged depuis >N jours              │
│    - Warning si >10 worktrees actifs (PR oubliées)                        │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Key decisions

| Dimension | Choix | Rationale |
|---|---|---|
| **Scope** | Feature PolyForge distribuable à tous les users | Pas juste claudeForge |
| **Infra** | Local macOS (launchd + `claude -p`) | Exploite quotas nocturnes, pas de cloud, keychain auth |
| **Détection plan** | `claude auth status` JSON, discover-as-you-go pour inconnus | Robuste à l'évolution Anthropic |
| **Autonomie** | Mix par type + profil-gated + allowlist stricte par routine | Trivial → auto-merge ; reste → PR `to-review` |
| **Isolation** | `git worktree add -b` off `origin/{base}` | Zero risque sur main, immune aux WIP locaux |
| **Circuit breaker budget** | `--max-budget-usd` natif pour **tous** les users | Spike confirmé ; supprime le besoin d'un tracker custom |
| **Telemetry budget** | Rolling window 5h local (JSONL) | Observabilité seulement |
| **System prompt strategy** | `full` / `targeted` / `minimal` par routine | Gain ~82% sur overhead cache creation |
| **Config format** | Section `routines` dans `polyforge.json` | Cohérence PolyForge |
| **Custom creation** | Scaffold guidé via `/polyforge-routines-create` | AskUserQuestion + templates → JSON + system prompt |
| **Daily report** | Routine séparée, schedule `end_window + 15min` | Pas de circularité avec le reste |
| **Cleanup** | Daemon séparé, schedule `end_window + 1h`, tied to PR status | Pas de suppression prématurée |
| **Kill-switch** | Fichier `~/.polyforge/PAUSE` | Pause instantanée sans toucher aux plists |
| **Timezone** | Heure système (limitation documentée) | `StartCalendarInterval` ne supporte pas TZ explicite |
| **Max runtime** | `ExitTimeOut` plist + `timeout(1)` wrapper | Évite runs fantômes |
| **First-run safety** | `first_run_dry: true` forcé, user promote avant mode réel | Filet de sécurité à l'install |
| **Run-now** | Bypass schedule + window, **jamais** le preflight | Garde kill-switch + rate-limit marker actifs |

---

## New PolyForge commands

- `/polyforge-routines-init` — détecte plan, propose profil, demande fenêtre horaire, branche base, labels GH, confirme installation plists, marque toutes les routines en `first_run_dry`
- `/polyforge-routines-create` — scaffold guidé : choix parmi scan/fix/review/report, AskUserQuestion pour cible/fréquence/autonomie/tools, génère config JSON + system prompt file
- `/polyforge-routines-manage` — `list | suspend {name} | resume {name} | delete {name} | run-now {name} | pause-all | resume-all | promote-from-dry {name}`
- `/polyforge-routines-logs` — derniers runs, erreurs, tokens par routine et par window 5h, coût équivalent pour référence

---

## Config schema : `polyforge.json` (section `routines`)

```json
{
  "routines": {
    "profile": "unleashed",
    "detected_plan": "team",
    "plan_detection": {
      "known_plans_version": "2026-04-16",
      "unknown_plan_logged": null
    },
    "window": {
      "start": "23:00",
      "end":   "07:00",
      "stop_before": "06:45",
      "timezone_note": "suit la TZ système"
    },
    "budget": {
      "max_budget_usd_per_run": 2.00,
      "telemetry_only_rolling_window_minutes": 300
    },
    "isolation": {
      "strategy": "worktree",
      "base_branch": "main",
      "base_ref": "origin/main",
      "worktree_root": "~/.polyforge/worktrees",
      "worktree_path_pattern": "{root}/{project_hash}/{routine_name}/{timestamp}",
      "cleanup_on_pr_closed_after_days": 3,
      "cleanup_schedule_offset_minutes": 60
    },
    "labels": {
      "auto_merge": "routine:auto-merge",
      "needs_review": "routine:to-review"
    },
    "concurrency": {
      "serial_lock": true,
      "max_parallel": 1
    },
    "reporting": {
      "daily_reporter_offset_minutes": 15,
      "notify": "github-issue"
    },
    "routines": [
      {
        "name": "issue-worker",
        "enabled": true,
        "first_run_dry": true,
        "schedule": "0 23 * * *",
        "template": "builtin:issue-worker",
        "autonomy": "pr-review",
        "model": "sonnet",
        "max_turns": 80,
        "system_prompt_strategy": "full",
        "allowed_tools": [
          "Read", "Write", "Edit", "Glob", "Grep",
          "Bash(git *)", "Bash(gh *)", "Bash(npm *)", "Bash(node *)"
        ],
        "auto_merge_allowlist": []
      },
      {
        "name": "pr-reviewer",
        "enabled": true,
        "first_run_dry": true,
        "schedule": "0 1 * * *",
        "template": "builtin:pr-reviewer",
        "autonomy": "auto-merge",
        "model": "sonnet",
        "max_turns": 30,
        "system_prompt_strategy": "targeted",
        "system_prompt_sources": [
          "rules/common/security.md",
          "rules/common/coding-style.md"
        ],
        "allowed_tools": [
          "Read", "Glob", "Grep", "Bash(git *)", "Bash(gh *)"
        ],
        "auto_merge_allowlist": [
          "patch-version-bump",
          "lint-only",
          "changelog-only"
        ]
      },
      {
        "name": "deps-security",
        "enabled": true,
        "first_run_dry": true,
        "schedule": "0 0 * * *",
        "template": "builtin:deps-security",
        "autonomy": "mixed",
        "model": "haiku",
        "max_turns": 15,
        "system_prompt_strategy": "minimal",
        "allowed_tools": [
          "Bash(npm *)", "Bash(git *)", "Bash(gh *)", "Read", "Edit"
        ],
        "grouping_strategy": "by-severity",
        "pr_policy": {
          "patch": "auto-merge",
          "minor": "to-review",
          "major": "to-review"
        }
      }
    ]
  }
}
```

Le champ `schedule` est en syntaxe cron-like ; le plist generator le traduit en `StartCalendarInterval` dict (Hour/Minute/Weekday).

---

## System prompt strategies

Chaque routine déclare une stratégie. Le runner construit le contexte en conséquence :

| Strategy | Contenu injecté | Overhead approx. | Routines concernées |
|---|---|---|---|
| `full` | CLAUDE.md complet + skills + memory | ~40k tokens | `issue-worker` (a besoin de tout le contexte projet) |
| `targeted` | Fichiers listés dans `system_prompt_sources` uniquement | ~5-10k tokens | `pr-reviewer`, `refacto-scanner`, `backlog-groomer` |
| `minimal` | Prompt de la routine + env vars essentiels | ~1-2k tokens | `deps-security`, `release-notes`, `daily-reporter` |

**Mécanisme** :
- `full` : laisse `claude -p` charger son contexte par défaut
- `targeted` : `--bare` + `--append-system-prompt-file` avec fichier généré par concaténation des sources
- `minimal` : `--bare` + prompt court inline

---

## Tasks (un seul PR, phases = ordre d'implémentation)

### Phase 0 — Spikes (DONE le 2026-04-16)

- [x] Valider `claude -p --output-format json` retourne tokens + cost
- [x] Valider `--max-budget-usd` existe et halt sur subscription auth
- [x] Valider keychain auth en subshell non-interactif
- [x] Valider `git worktree add -b` off main sans collision
- [x] Valider `claude auth status` retourne `subscriptionType`
- [x] Définir `system_prompt_strategy` par routine (3 niveaux)
- [x] Stratégie discover-as-you-go pour valeurs `subscriptionType` inconnues

### Phase 1 — Foundation (parallelizable)

- [ ] **Task 1.1**: Schema + parser section `routines` dans `polyforge.json` avec validation stricte — Files: `lib/routines/config.js`, `lib/routines/schema.js`
- [ ] **Task 1.2**: Plan detector avec schema validation + fallback + logging valeurs inconnues — Files: `lib/routines/plan-detector.js`
- [ ] **Task 1.3**: 5 profils (`light`, `standard`, `full`, `unleashed`, `budget-driven`) : mapping routines, modèles, strategies — Files: `lib/routines/profiles.js`
- [ ] **Task 1.4**: System prompt builder (3 strategies) : génère le fichier à passer à `--append-system-prompt-file` — Files: `lib/routines/prompt-builder.js`
- [ ] **Task 1.5**: Générateur launchd plists (`com.polyforge.routine.{name}.plist`) avec `ExitTimeOut` + `StartCalendarInterval` + traduction cron→plist — Files: `lib/routines/launchd.js`, `templates/routines/plist.hbs`
- [ ] **Task 1.6**: Preflight runner inline : kill-switch, plan, window, rate-limit marker, fetch origin, network, disk — Files: `lib/routines/preflight.js`, `bin/polyforge-routine-runner.sh`
- [ ] **Task 1.7**: Serial lock global (flock) — Files: `lib/routines/lock.js`
- [ ] **Task 1.8**: JSONL logger `~/.polyforge/logs/{name}.jsonl` + rotation — Files: `lib/routines/logger.js`
- [ ] **Task 1.9**: Telemetry rolling-window tracker (observabilité, pas de gate) — Files: `lib/routines/telemetry.js`
- [ ] **Task 1.10**: Rate-limit handler : détecte `api_error_status`, écrit marker, propage stop — Files: `lib/routines/rate-limit.js`
- [ ] **Task 1.11**: Worktree manager : path pattern `{root}/{project-hash}/{name}/{ts}`, add/list/remove — Files: `lib/routines/worktree.js`
- [ ] **Task 1.12**: Network retry wrapper (exp backoff, 3 max) pour ops `gh` — Files: `lib/routines/net-retry.sh`
- [ ] **Task 1.13**: Cleanup daemon : plist séparé, scan worktrees, remove si PR closed >N jours, warning >10 actifs — Files: `lib/routines/cleanup.js`
- [ ] **Task 1.14**: `/polyforge-routines-init` skill — Files: `skills/polyforge-routines-init/SKILL.md`
- [ ] **Task 1.15**: `/polyforge-routines-manage` skill (inclut `promote-from-dry`) — Files: `skills/polyforge-routines-manage/SKILL.md`
- [ ] **Task 1.16**: `/polyforge-routines-logs` skill — Files: `skills/polyforge-routines-logs/SKILL.md`

### Phase 2 — Bundled routines (depends on Phase 1)

**Dev workflow bundle** (profils `full` et `unleashed`)
- [ ] **Task 2.1**: `builtin:issue-worker` (strategy=`full`, model=sonnet) — pick issue labellée `ready`, plan, code, test, push PR avec label `to-review` — Files: `templates/routines/issue-worker/{prompt.md,system-prompt.md,config.json}`
- [ ] **Task 2.2**: `builtin:pr-reviewer` (strategy=`targeted`, model=sonnet) — `/polyforge-review`, merge si allowlist match + CI vert — Files: `templates/routines/pr-reviewer/`

**Code hygiene bundle** (profils `standard`+)
- [ ] **Task 2.3**: `builtin:refacto-scanner` (strategy=`targeted`, model=haiku) — `/refactor-clean`, PR avec label `to-review` — Files: `templates/routines/refacto-scanner/`
- [ ] **Task 2.4**: `builtin:deps-security` (strategy=`minimal`, model=haiku, actif dès `light`) — `npm outdated` + `npm audit`, grouping **by-severity** : 1 PR patch avec label `auto-merge`, 1 PR minor avec `to-review`, 1 PR major avec `to-review` — Files: `templates/routines/deps-security/`

**Backlog mgmt bundle** (profils `standard`+)
- [ ] **Task 2.5**: `builtin:backlog-groomer` (strategy=`targeted`, model=haiku) — triage issues, labels, priorité, stale detection — Files: `templates/routines/backlog-groomer/`
- [ ] **Task 2.6**: `builtin:release-notes` (strategy=`minimal`, model=haiku, actif dès `light`) — changelog hebdo depuis commits mergés — Files: `templates/routines/release-notes/`

**Reporting** (tous profils)
- [ ] **Task 2.7**: `builtin:daily-reporter` (strategy=`minimal`, model=haiku) — lit JSONL de la nuit, markdown résumé, poste en issue GH ou Slack webhook — Files: `templates/routines/daily-reporter/`

### Phase 3 — Custom routine creator

- [ ] **Task 3.1**: Scaffolds library (`scan` / `fix` / `review` / `report`) avec defaults `allowed_tools` + `system_prompt_strategy` — Files: `templates/routines/_scaffolds/`
- [ ] **Task 3.2**: `/polyforge-routines-create` skill avec AskUserQuestion guidé (cible, fréquence, autonomie, tools, conditions de succès) — Files: `skills/polyforge-routines-create/SKILL.md`
- [ ] **Task 3.3**: Generator : réponses → config JSON + system prompt file — Files: `lib/routines/generator.js`

### Phase 4 — Verification & Documentation

- [ ] **Task 4.1**: Tests unitaires (parser, plan-detector, preflight, telemetry, prompt-builder, worktree) avec `node --test` — Files: `tests/routines/*.test.js`
- [ ] **Task 4.2**: Dry-run mode complet (no push/merge/PR, logs complets) — Files: `bin/polyforge-routine-runner.sh`
- [ ] **Task 4.3**: Doc `docs/ROUTINES.md` : quickstart par plan, troubleshooting (wake, rate-limit, worktree, plan misdetection, first-run-dry promotion) — Files: `docs/ROUTINES.md`
- [ ] **Task 4.4**: Dogfood sur `claudeForge` pendant 7 nuits en profil `unleashed`. Critères de succès : 0 merge cassant, ≥5 auto-merges (deps patch), ≥3 PRs reviewées manuellement, 0 blocage budget, plan-detector valide correctement `team`. Notes dans `docs/ROUTINES-DOGFOOD.md`

---

## Risks & Considerations

### 🔴 Risques bloquants résiduels

- **macOS wake unreliability** : `pmset` / launchd rate si Mac en deep sleep batterie ou complètement éteint. Mitigation : exiger branchement secteur (preflight), `caffeinate` pendant la fenêtre, `StartCalendarInterval` qui re-fire au wake sur sleep simple. **Edge case boot-from-off** : `StartCalendarInterval` ne rattrape pas les events manqués si Mac était éteint — documenté comme limitation.
- **Plan detector face à nouveaux plans** : Anthropic peut renommer ou ajouter des `subscriptionType`. Mitigation : schema validation + fallback `standard` + warn + log de la valeur inconnue pour feedback loop ; collection empirique au fil des installs user.
- **LLM code quality sans review** : risque fondamental du travail autonome. Mitigation : allowlist par routine (explicite dans config), CI vert obligatoire, first-run-dry obligatoire, daily-reporter liste chaque auto-merge, kill-switch `~/.polyforge/PAUSE`.

### 🟡 Risques gérables

- **Budget checked après la call** : `--max-budget-usd` halt après le run qui excède, pas avant. Un run peut donc légèrement dépasser. Mitigation : budget par run calibré avec marge (ex : 0.8 × cap visé).
- **Rate-limit en cours de fenêtre** : si user a consommé la journée, routine hit le cap rapidement. Mitigation : marker `rate-limited-until.json` coupe les runs suivants jusqu'au reset, daily-reporter note les skips.
- **Worktree disk accumulation** : PR oubliée → worktree persiste indéfiniment. Mitigation : warning si >10 actifs, cleanup tied to PR status.
- **Merge conflicts concurrents** : user push sur main pendant routine. Mitigation : worktree isolé + rebase sur origin/main en fin de run, abort propre si conflit (pas de force-push).
- **Timezone** : launchd suit la TZ système, voyage = fenêtre décalée. Documenté.
- **Local telemetry desync** : le rolling window local ne voit que les runs routines, pas les calls interactifs. Acceptable car le **gate** est `--max-budget-usd`, pas le rolling window — donc desync n'affecte que l'observabilité.

### Contraintes techniques

- Node.js ≥18, git ≥2.38, macOS 13+
- Abonnement Claude (pro/max/team/enterprise) OU clé API Anthropic
- `claude auth login` actif pour les abonnés
- `gh auth login` ou `GH_TOKEN` pour GitHub
- Branchement secteur requis pour wake reliability

---

## Out of Scope

- Linux / Windows support (phase ultérieure via systemd / Task Scheduler)
- GitHub Actions backend
- Mode équipe multi-user sur même Mac
- Routines webhook-driven (push, PR opened)
- Intégration Linear/Jira au-delà de `/polyforge-fix` et `/polyforge-review`
