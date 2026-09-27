# ADR-0025: oxlint as the linter

- Status: Accepted
- Date: 2026-08-09
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

In the Effect edition, ESLint took 30 seconds on a cold run over ~850 files, 87% of it type-awareness, and in-editor feedback paid the same price on every keystroke. This repository starts on oxlint and inherits the decision; what this ADR records is why the decision holds without Effect, and the two behaviours of the type-aware engine that shaped the port.

The lint config is not incidental to this codebase. It carries the file taxonomy of ADR-0008, the schema boundaries of ADR-0020, the factory fences of ADR-0006/0007/0021, and five local rules. Any linter has to run all of that.

## Decision

oxlint is the only linter, including its type-aware mode (`oxlint-tsgolint`), pinned exact and bumped as a pair. ESLint is not installed; the `eslint-plugin-*` packages that remain (`simple-import-sort`, `sort-destructure-keys`, `storybook`) are loaded by oxlint as JS plugins.

### What the plugin model requires

oxlint's config is JSON and its JS plugin support is alpha. Three consequences shape the setup:

- The architecture policy is authored in `architecture.yaml` (ADR-0031) and evaluated by `@goodbones/oxlint`'s plugin; the JSON names the plugin and its five rule ids and nothing else about the policy.
- Overrides have no `ignores`, and a negated glob in `files` widens the match rather than narrowing it. Rules that were scoped by exclusion own their exemptions in code, which makes those exemptions testable.
- An override cannot turn off a plugin's rule unless it also declares that plugin.

### The local rules

`scripts/lint-rules/` holds the hand-rolled AST rules that are not boundary rules: `no-cross-schema-sql-access` (ADR-0020; it recognises `sql`, `sql.type(...)`, `sql.fragment` and `sql.unsafe`), `no-deep-relative-imports`, `no-relative-import-outside-package`, `no-array-push-spread`, `lucide-icon-suffix`, `no-inline-styling` and `enforce-react-namespace`. Every one of them is probed by `pnpm lint:rules`.

### Two behaviours of the type-aware engine, and what they cost

**The program is the file's import graph.** tsgolint does not build the program from a tsconfig's `include`; it builds it from what the linted file imports. A TypeScript module augmentation declared in a file the linted file does not (transitively) import is invisible, and every type that depends on it collapses to `error`. The `@org/authz` `AuthzConfig` augmentation is declared once in `platform/auth/authz.ts`, so a policy file that imported `ResourceCheck` from `@org/authz` directly saw a caller typed `never` and failed `no-unsafe-argument` while `tsc -b` was clean. The fix is structural rather than a suppression: `platform/auth/authz.ts` re-exports the policy vocabulary, and a module's policies import it from there (ADR-0021). The side-effect import `import "@/platform/auth/authz.js"` does **not** carry the augmentation — only a binding does.

**The autofixer rewrites declaration merges.** `consistent-type-definitions` and `no-empty-interface` rewrite `export interface X extends Y {}` to `export type X = {} & Y`. That is the wrong answer for this codebase's DI tokens, which are an `interface X extends LibType {}` merged with an `abstract class X {}` so one name is both the type and the injection token (ADR-0006), and for the `declare module` augmentations of `AuthzConfig`, `PolicyMap` and `ResourceResolverMap`, which must be interfaces to merge at all. A `--fix` run turned all of them into type aliases and broke the build twice before the overrides were written. `.oxlintrc.json` therefore turns those rules — and `no-unsafe-declaration-merging` — off for the eight token files and for `modules/*/policies/*.ts`, `platform/auth/authz.ts` and the authz package's own tests. Run `pnpm lint:fix` and expect a clean `tsc -b` afterwards; if either file set changes, extend the override before the fixer meets it.

### Vacuity probes

Every architectural rule runs through an alpha plugin system, where the failure that matters is not a crash but a rule going silently vacuous. So each rule has a probe: a file that violates it, written to a path its globs match, linted, and asserted on. `pnpm lint:rules` runs them, and CI runs it beside `pnpm lint`. The goodbones plugin additionally refuses to load if any manifest rule fails its own generated probe (ADR-0028).

### TypeScript stays on 5

`typescript` is 5.9.3 with its API intact, which the goodbones TypeScript pack and the tsgolint program share. There is no TypeScript 7 alias here, because there is no Effect plugin that needed one.

## Consequences

- `pnpm lint` is a few seconds rather than tens, in editors as well as CI.
- `pnpm lint:rules` and `pnpm lint:edges` join `check:all` and CI as distinct gates.
- `no-redeclare` is off: oxlint's rule reports TypeScript declaration merging, which the DI-token idiom relies on. A real redeclaration is TS2451; the compiler owns it.
- `no-console` is off under `packages/cli/src`, `packages/mcp/src` and `packages/jobs/src`: those processes write to stdout on purpose.
- A test file may use non-null assertions and unnecessary-condition checks freely; the two rules are off under `**/*.test.ts` and the harness folders.

## Supersedes / differs from the Effect edition

The `@effect/tsgo` patch, the `check:effect` gate, the TypeScript 7 alias and the `effecttsgo/*` rules are gone with Effect. The augmentation-visibility and autofixer behaviours are new findings recorded here because they shaped the code (ADR-0033).

## Alternatives considered

- **ESLint with typescript-eslint.** Rejected on the original measurement; nothing in this edition changes the arithmetic.
- **Biome.** Rejected: no type-aware rules and no JS plugin model, so neither the manifest nor the type-aware rules could run.
- **Suppress the augmentation findings per line.** Rejected: fifty suppressions that each say the linter is wrong, against one re-export that makes it right.

## Related

- ADR-0008, ADR-0020, ADR-0021, ADR-0028, ADR-0033.
