# ADR-0028: the architecture manifest

- Status: Accepted
- Date: 2026-08-31
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033); the shape is inherited, the tree it describes is this repository's

## Context and Problem Statement

ADR-0027 consolidated three enforcement engines into one plugin driven by configuration. The first configuration that produced was four flat arrays keyed by rule family, and everything the architecture said about one file was scattered across them: to know what governed `modules/<m>/domain/<sub>/*.repository.ts` you read a folder entry, a parity entry, three import rules and a members rule, and nothing said they were related.

Two further problems came from the shape rather than the scattering. **Denylists go vacuous quietly**: a `toNot` that widens by one pattern silently stops firing, which is the exact failure the probe machinery exists to catch. And **`$1` is not a name**: backreferences inherited from dependency-cruiser meant "my own module" was a positional trick that only worked on one side of a rule.

This edition inherits the manifest form and writes a new tree in it. The question it had to answer afresh is what the tree says when the framework beneath it is Nest.

## Decision

Write the policy as a **manifest**: one tree of the repository where every node states what that part of the tree may import, who may import it, which names it may declare, and which siblings its files owe.

```yaml
"@/modules/{module}/domain/{subdomain}/":
  imports:
    {
      reset: true,
      external: [oxide.ts, zod],
      allow: ["@/modules/{module}/domain/{subdomain}/**", …],
    }
  children:
    "*.repository.ts":
      requires: ["../../infrastructure/repositories/{base}-live.ts", …]
      importedBy: { allow: ["@/modules/*/commands/**", …] }
      members:
        - { subject: members, in: "*Repository*", allow: [findOne, findMany, insertOne, …] }
```

**The manifest is the authoring surface; the flat rules stay as the IR.** It compiles down to the `imports` / `exports` / `members` / `structure` / `surface` rules the engine runs, so the evaluators, resolution and probe machinery are shared with every other repository on the engine.

### Allowlists, not denylists

An allowlist cannot widen silently: permitting something means naming it, at the node that permits it. The domain tier's allowlist is what keeps `@nestjs/*`, `@org/database`, `@org/event-bus` and `@org/unit-of-work` out of `domain/`: none of them is named there, and `platform/ddd/contracts/` is, which is the whole of ADR-0007's "the domain never names the library" in one list.

### Named captures, and a compile error where they cannot work

`{module}` and `{subdomain}` replace `$1`. Where a capture genuinely cannot resolve — `importedBy.allow` is matched against the _importer_, but the capture was declared by the _target's_ path — the compiler refuses to compile rather than emit an exemption that never matches.

### One merge rule, and prohibitions outside it

Allowances inherit until a node `reset`s. Prohibitions are emitted once over the subtree that declares them and always accumulate, so **no node can make a subtree quieter than its ancestors**. An exemption to a prohibition is declared by the prohibition (`except`, `matchNot`), never by the tier escaping it.

### Probes are generated

A node's own path _is_ its probe, and the plugin refuses to load if any rule fails its own.

### What this tree says that the Effect edition's did not

- **Decorators are imports.** `@CommandHandler`, `@Injectable`, `@Controller` and `@Inject` are names imported from `@nestjs/*`, so the manifest can say where each may appear: `@nestjs/cqrs` in `commands/`, `queries/`, `event-handlers/` and the module root; `@nestjs/common` in the adapters, the policies and the module root; neither in `domain/`.
- **Nest's own module system is a tier.** `<feature>.module.ts` is the wiring plane; it may name `@nestjs/common` and other modules' `<feature>.module.ts`, and nothing else may name it except its own `<feature>.platform.ts`. `platform/modules/` is where `@Global()` modules and the `AppModule` live, and only `main.ts`, `test-utils/` and `platform/` reach it.
- **The kernel is workspace packages.** `~/event-bus/`, `~/unit-of-work/` and `~/authz/` each have a node beside their code; the server reaches them only from `platform/`, and the domain reaches their vocabulary only through `platform/ddd/contracts/` and `platform/auth/authz.ts`.
- **`@nestjs/cqrs`'s event bus is refused by name** (ADR-0030), because an allowlist cannot refuse one export of a package it admits.

### Naming, because a taxonomy is only half a convention

`children` enumerates the stereotypes a folder admits and says nothing about the concept name in front of one. A node therefore carries a `name`: one of four conventions, a regex with a sentence saying why, or `{ like: "{capture}" }`, inheriting like `imports`. A file's concept name is its basename up to the first dot, so `todos.repository-live.ts` is judged on `todos` (ADR-0024). A custom regex still owes a counter-example: the compiler tries candidate names and refuses a pattern that admits all of them.

This repo declares kebab-case for the server, web, components, jobs, cli, mcp, api-client and the three kernel packages; PascalCase for `contracts/src`; snake_case for the numbered migrations; and `{ like: "{subdomain}" }` on `domain/{subdomain}/*.root.ts`.

### The server gets a single root

`packages/server/src` is one `~/server/src/` node with `main.ts`, `instrumentation.ts`, `common/`, `platform/`, `modules/{module}/` and `test-utils/` as children: one taxonomy root, one naming declaration, and a stray `src/helpers/` is a violation rather than a gap.

## Consequences

- Everything is covered: every package including the three kernel packages, and the dependency direction between packages (`contracts ← api-client ← cli`, `database ← jobs`, `event-bus ← unit-of-work ← server`, and nothing reaching the server) is enforced.
- Two gates, not one: `lint:rules` proves the wiring; `lint:edges` proves the semantics. The allowed rows carry equal weight.
- `explain` answers "what governs this file?", which a tree answers well and a flat config badly.

## Supersedes / differs from the Effect edition

The form, the merge rule, the captures and the naming field are unchanged. The tree is new: it names decorators as imports, treats Nest's module files as a wiring tier, and governs three workspace kernel packages instead of one installed library. The measured counts in the original (rules ported, edges tightened, bugs the port found) belong to that repository and are not restated here; this edition's numbers live in `pnpm architecture:coverage` and `pnpm lint:edges`.

## Alternatives considered

- **Keep a flat config.** Rejected: the scattering is why three repo-wide rules had once been applied to one region only.
- **A glob quantifier instead of a `name` field.** Rejected: it puts the convention into each of a hundred keys, cannot constrain a folder capture, and cannot express "named after its folder".

## References

- ADR-0027, ADR-0029, ADR-0030, ADR-0031, ADR-0032, ADR-0033.
