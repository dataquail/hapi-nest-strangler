# Rule: architecture rules (the manifest)

**Scope:** the whole repo — read before adding, changing, or removing an architectural check.
**Backing ADRs:** 0008 (architecture enforcement), 0025 (oxlint as the linter), 0027 (architecture rules as configuration), 0028 (the manifest), 0029 (the engine as a dependency), 0030 (surfaces, graph rules and ratchets), 0031 (the manifest as YAML, one file per package).

Architectural enforcement runs inside `pnpm lint`, from one assembled manifest — plus the rules only a whole-repository walk can answer, which `pnpm lint:architecture` evaluates.

| Where                                           | What it owns                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `architecture.yaml`                             | the repo-wide policy: resolve, aliases, `deny`/`exports`, `graph`, `limits`, the shared `defs`, and the tree's index |
| `packages/<package>/architecture.yaml`          | that package's node of the tree, beside its own code, with the `defs` only it uses (fourteen packages)               |
| `@goodbones/{core,typescript,cli,oxlint}` (npm) | the engine: lowering, matching, the graph, the anti-vacuity guard; the TS pack; the two hosts                        |
| `scripts/lint-rule-probes.mjs`                  | `pnpm lint:rules` — each rule id still fires on a planted violation                                                  |
| `scripts/architecture-edges.mjs`                | `pnpm lint:edges` — the policy still refuses and allows the edges and shapes it should                               |
| `scripts/lint-rules/`                           | the hand-rolled `local/*` AST rules that are not boundary rules                                                      |

**The engine is an installed dependency, not source here.** It ships from `dataquail/goodbones` as four packages, each pinned to an exact beta in the root `package.json` (`core` and `typescript` at `0.1.0-beta.15`, `cli` and `oxlint` at `0.1.0-beta.17`, all on one `core`; `@goodbones/campaigns` at `0.1.1-beta.6`). Its reference documentation lives at <https://dataquail.github.io/goodbones>. This repo owns the **policy** — the manifest, the probes, the edge table — and nothing below describes the library. Changing how a rule family behaves means a release there, not an edit here (ADR-0029). **The three kernel packages (`@org/event-bus`, `@org/unit-of-work`, `@org/authz`) are the opposite: workspace source, each with its own manifest node.**

**One policy, several files, one evaluation.** The engine discovers exactly one of `architecture.yaml`, `.yml`, `.json` or `.config.mjs` at the root. Under `tree`, each package's key is `{ include: packages/<package>/architecture.yaml }`: the file beside the package holds that one node and is **replaced whole** — nothing may be written beside `include`, and there is no merge. A package's file may carry a `$schema` and a top-level `defs`; every file's `defs` share one namespace, and a name defined twice is refused. Put a fragment in the narrowest file that covers all its users — the server's four test fragments in the server's file, `view-file` in web's, `frontend-test-file` and the kernel packages' test fragments in the root. Do **not** split the _run_ to match: a rule fires when the checker visits the **importing** file, so a per-package check would silently disarm every `importedBy` and every repo-wide prohibition. Rules, probes, coverage and the baseline are computed on the assembled manifest; an error inside an included file is reported as `packages/server/architecture.yaml:12:5`.

The first line of each file names the JSON Schema the engine generates from its own decoder. **Quote every glob and every message**: a bare `*` opens an alias, `@` and a backtick are reserved, `{` opens a flow mapping, and ` #` starts a comment. Long messages are `>-` folded block scalars.

## The manifest

It reads like a directory listing. A key ending in `/` is a folder, anything else is a file, and everything the architecture says about a part of the tree is written **at that part of the tree**:

```yaml
"@/modules/{module}/domain/{subdomain}/":
  message: "…what this folder admits…"
  imports: { reset: true, message: "…", external: [oxide.ts, zod], allow: ["…"] }
  children:
    "*.root.ts": {}
    "*.repository.ts":
      requires: ["../../infrastructure/repositories/{base}-live.ts", …]
      importedBy: { message: "…", allow: ["@/modules/*/commands/**", …] }
      members:
        - {
            subject: members,
            declares: [type, interface],
            in: "*Repository*",
            allow: […],
            probe: { source, name },
          }
      surface:
        - { message: "…", declares: [function, variable] }
```

| Field        | Question it answers                             |
| ------------ | ----------------------------------------------- |
| `imports`    | what may this reach?                            |
| `importedBy` | who may reach this?                             |
| `members`    | which names may it declare or call?             |
| `surface`    | what may it export?                             |
| `requires`   | which siblings does this file owe?              |
| `children`   | which files and folders does this folder admit? |

Repo-wide statements sit at the top level: `deny` (prohibitions that hold everywhere — nothing imports a test; slonik only inside `@org/database`), `exports` (who may import a given exported symbol, and in which binding form), `graph` and `limits`.

**Decorators are imports.** `@CommandHandler`, `@Injectable`, `@Controller` are names from `@nestjs/*`, so the tier allowlists say where each may appear: `@nestjs/cqrs` in `commands/`, `queries/`, `event-handlers/` and the module root; `@nestjs/common` in the adapters, policies and module root; neither in `domain/`.

## Reuse: `defs` and `use`

The top-level `defs` map names fragments — a whole node, an `imports` object, an `importedBy`, or one rule of `members`/`surface`/`exports`/`deny` — and `{ use: <name> }` anywhere below is replaced by a copy before the manifest is decoded. A key written beside `use` overrides the fragment's key **shallowly**: a list replaces the list. That is why every root that adds a default-export exemption repeats `**/vitest.config.ts` beside its own. The schema admits `use` at node, `imports` and rule-item positions, not inside an `allow` list — so a shared consumer list is a whole `importedBy` fragment (`port-consumers`, `acl-port-consumers`). Reach for `defs` before a YAML anchor: an error inside a merged key cannot name its line.

## Naming

`children` says which stereotypes a folder admits; `name` says what the concept name in front of the stereotype may look like. It takes `"kebab-case"`, `"camelCase"`, `"PascalCase"`, `"snake_case"`, `{ regex, message }` or `{ like: "{capture}" }`, and **inherits like `imports`**. A file's concept name is its basename up to the **first dot** — `todos` in `todos.repository-live.ts`. A folder node's `name` also judges its own segment when its key declares a capture, which is what refuses a module folder named `Todos_V2`. `{ like: "{subdomain}" }` on `domain/{subdomain}/*.root.ts` says `todo/` holds `todo.root.ts`. Kebab-case for the server, web, components, jobs, cli, mcp, api-client and the kernel packages; PascalCase for `contracts/src`; regexes with a named exception for `Database.ts` and `features/__root/`.

## Surface: what a file may export

`surface` is an array on a node; on a folder it covers the subtree. Each entry **selects** export sites — `kinds` (`named`, `default`, `namespace`), `declares`, `reexport`, `match` — and makes **exactly one demand**: `forbid` (the default), `allow`, `convention`, or `count`. `except` lists files the entry does not apply to.

- **No default exports**, except where a framework demands one — Next routes and config, knex migrations, stories and the Storybook config, vitest configs and `globalSetup`.
- **No `export *`** in the server and web; `platform/ddd/contracts/domain-event.ts` and the web test-fixtures barrel are the two exemptions.
- **A handler file exports exactly one `*Handler`** (a class); a message file exports the class, its payload and its result alias.
- **A port exports types and its abstract class, never a value.**
- **The peer surface (`<feature>.exports.ts`) declares only `<module>Access<Queries|Commands|DomainEvents|Errors>` values and re-exports nothing.**
- **A test exports nothing.**

## Patterns

Globs over repo-relative paths, matched against **fully resolved** targets: `*` part of one segment, `**` any number (`a/**` matches `a` itself), `{name}` a capture, `[A-Z]` a class, `a | b` several patterns on one node. A `{capture}` may **not** appear in `importedBy.allow`; the compiler refuses it rather than emit an exemption that never matches. A graph rule's globs carry no captures either.

## Tight by default; laxity is opted into by name

A folder admits only the children it lists; a file may import only what it or an ancestor allows. Three escape hatches, all greppable: **`reset: true`** (stop inheriting), **`unrestricted: true`** (no allowlist yet — required whenever a node states `imports` without `allow`), **`layout: open`** (this folder does not enumerate its file names, but is claimed). **Prohibitions are the exception**: a `deny` is emitted once over the subtree that declares it and always accumulates; an exemption is declared _by the prohibition_ (`except`, `matchNot`).

## Export restrictions see every binding form

An `exports` restriction speaks to the binding forms its `kinds` lists, default `["named"]`. Every whole-module form — `import * as`, `export *`, `export * as`, `import()`, `require()` — is the one `namespace` binding named `*`, so a rule listing `symbols` cannot also list `namespace`. That is why `@nestjs/cqrs` is fenced by **two** restrictions: `no-nest-event-bus` names `EventBus`, `EventsHandler`, `Saga`, `ofType`, `IEvent`, `IEventHandler`, and `no-whole-nest-cqrs-imports` refuses the namespace form that would carry them past it. `bus-factories-at-composition-roots` fences `makeEventBus`, `makeUnitOfWork`, `makeUnhandledFailures` to `platform/cqrs/` and `test-utils/`; `authz-registries-at-composition-roots` fences `makePolicyRegistry`, `makeResourceResolverRegistry`, `makeHasPermissions` to `platform/auth/` and `platform/modules/`.

## Graph: the whole repository at once

```yaml
graph:
  cycles: [{ name, message, within, withinNot? }]
  orphans: [{ name, message, within, withinNot?, entry }]
  reach: [{ name, message, from, fromNot?, to, toNot?, via? }]
```

**Only `pnpm lint:architecture` evaluates them.** The plugin compiles and probes them — a vacuous one still fails `pnpm lint` — but never runs them. That asymmetry is why the CLI is a gate in `check:all`.

- `no-cycles` covers every package; oxlint's `import/no-cycle` stays on for editor speed.
- `no-orphans`: a file nothing imports is dead unless it is an **entry** — a test by glob, a process by `bin` (`main.ts`, the CLI, MCP and jobs mains, the database scripts), a framework by convention (Next `app/**`, `instrumentation.ts`, Storybook), a package's published `exports`. Fakes are `withinNot`. **Do not list a path as an entry to make a finding go away.**
- `reach`: the domain and the use cases reach no adapter; `platform/` reaches a module only through its `<feature>.platform.ts` (`via`); web never reaches the server; contracts reach nothing.

## Limits: the policy's own ratchets

```yaml
limits:
  unrestricted: 1
  partial: 0
  coverage: { imports: 0.99, structure: 0.71, members: 0.03, surface: 0.95, graph: 1 }
```

The ceilings cap the tiers that say "not tightened yet" (`main.ts`). The floors are the fraction of walked files each family reaches; set each to what `pnpm architecture:coverage` reports, rounded **down**. Raise a floor when coverage rises; never lower one to make a red run green.

## Conformance: what `check` measures but does not gate

`pnpm architecture:conformance` never fails; it names **residue** (files no family reaches), **vacant** nodes (an allowlist selecting no file — `event-handlers/`, `sagas/`), **slack** (allowances no import uses), **concentration** (a fragment entry used at fewer than half its nodes) and **cycles**. `limits.conformance` in `architecture.yaml` holds the first four to ceilings that `pnpm lint:architecture` gates, ratcheted like the coverage floors: lower a ceiling when the number falls, never raise one. `residue` sits at zero; cycles are held at zero by the `no-cycles` graph rule.

## Every rule proves itself

The manifest compiles to flat rules, each with a probe generated from the node's own path; **the plugin refuses to load if any rule fails its own probe.** A generated probe never meets a parser, so `members`, `exports` and `surface` rules about a declaration shape carry an **authored** probe (`probe: { source, name | symbol }`) — the repository-vocabulary rules, the peer-surface rules, and the four `exports` fences each have one. Weaken a probe once and confirm the loader refuses.

Two gates back that up: `pnpm lint:rules` proves the **wiring** (plugin loaded, rule ids enabled, globs match, resolution live); `pnpm lint:edges` proves the **semantics** (a table of edges with expected verdicts and graph shapes with expected reports). The allowed rows matter as much as the refused ones.

## Resolution

`resolve.scopes` maps a file pattern to a language pack and a tsconfig whose `paths` resolve the scope (`tsconfig.resolve-web.json` for web and components, the acceptance tsconfig, `tsconfig.resolve.json` for everything else). Path targets are **extensionless**; the resolver maps `.js` to `.ts` on the specifier. **An unresolved import is a hard lint error**, not a skip.

## The CLI, and the baseline

```
pnpm lint:architecture              # every family, the graph rules, the coverage floors, the baseline ratchet
pnpm architecture:baseline          # record the violations this repo carries
pnpm architecture:explain <file>    # which rules of every family select this file, and why
pnpm architecture:facts <file>      # what the parser read: edges, bindings, members, calls, exports
pnpm architecture:coverage          # reach per family, and the adoption backlog
pnpm architecture:conformance       # residue, vacancy, slack, concentration — a measurement, never a failure
```

Write a new `members` or `surface` rule against `facts` output, not against what you remember a file exporting.

**The baseline is a ratchet, not a suppression list.** `.architecture-baseline.json` entries are line-independent fingerprints (`kind|rule|file|subject`), and a stale entry is an error. This repo carries none, and the file does not exist. Keep it that way.

## The plugin arrives built

oxlint loads plugins with a bare `import()`, and `.oxlintrc.json` names `@goodbones/oxlint/plugin`. The published tarball carries compiled JavaScript, so no lint command builds anything. Bump the pin deliberately, then run `pnpm lint:rules` and `pnpm lint:edges`. Every `architecture/*` rule id — `imports`, `exports`, `members`, `structure`, `surface` — must be enabled in `.oxlintrc.json`.

## Campaigns: the strangling, measured

The `campaigns` key in the root manifest holds `strangle-hapi` (ADR-0035): the count of what is left of each hapi module, and the phases it moves through. The engine's reference is <https://dataquail.github.io/goodbones/campaigns/getting-started/introduction/>; what this repo owns is the campaign, its functions and its ledgers.

- **Sectors** are the five hapi modules, each marked by `src/application/<m>/sector.ts`, whose exported `sector` object lists what the module owns on both servers. Everything else in the hapi package is the `legacy` sector, parked at the first phase.
- **Shared** (`shared:` on the campaign) is the strangling's own hapi-side scaffolding — the backend client, `proxyToNest`, the mirror plugin and its event constants. Every sector leans on it and none takes it away, so it is no sector's and not the legacy: measured, never held. `mirrored` declares `grows: [hapi-lines]`, so a dual-write PR needs no concession.
- **Phases** `fenced → rebuilt → mirrored → backfilled → served → routes-moved → data-moved → gone → settled (open)`, each recognised by the objectives it lists (ADR-0035, amended 2026-10-01 for the dual-write plan). `backfilled` is `attested: true` — recorded with `campaigns attest`, since no detector sees a backfill run; `mirrored` carries `onTouch: advise` because the legacy module grows there by design. Every other phase's position is derived from its holdouts, never set.
- **Objectives** are detectors with probes: two `fn` terms in `campaigns/strangle-hapi.mjs` (cross-module reach, hapi lines), four `syntax` terms (role checks in routes; knex writes whose method emits no mirror event (`mirrorEvents.*`, forwarded by hapi's mirror plugin); route handlers that are not `proxyToNest(...)`; knex writes left at all), four sector `has` terms (the Nest module exists; an internal endpoint names the inter-service guard; a user-facing endpoint names the user guard; a `*_drop_*` legacy migration exists), three `path` terms (routes, models, files left). The `syntax` terms are ast-grep rules — `inside`, `has`, `not`, `field` — so they count statements and route definitions, not files. The loader runs the probes; a detector that stops firing on its probe stops the policy loading. `pnpm architecture:explain <file>` prints each term's hit count on that file, which is how a detector is tuned.
- **Ledgers** live in `.architecture-campaigns/strangle-hapi/`, one JSON per objective plus `plan.json` and `sectors/`. `pnpm campaigns:clear` shrinks them; `architecture objectives concede <campaign>/<objective> --reason "…"` is the only way they grow; a changed defined phase needs a `concessions` entry on the phase.
- **The ratchet** is `onTouch: ratchet`: `architecture/campaigns` reports a new holdout in the editor, `pnpm lint:architecture` fails on it, and `pnpm campaigns:nudge` (in `check:all`) exits non-zero when a touched sector got worse. Paydown goes in its own commit, followed by `pnpm campaigns:clear`.
- **Every script that decodes the manifest must pass `campaignsExtension`** (`scripts/architecture-edges.mjs` does), or `campaigns` and `ledger` are unknown keys. `@goodbones/campaigns` is pinned at the root for that reason.
