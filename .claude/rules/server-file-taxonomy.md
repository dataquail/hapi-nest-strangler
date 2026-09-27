# Rule: server file taxonomy (layout + test parity)

**Scope:** `packages/server/src/` — read before creating any new file kind, test, fake, or stereotype. Enforced by `pnpm lint`.
**Backing ADRs:** 0008 (architecture enforcement), 0027 (architecture rules as configuration).

The file taxonomy — layout (which file kinds a folder admits), sibling parity (required tests/fakes/stories), and the folders a module may have — lives in `packages/server/architecture.yaml`, written at the node of the tree it describes and enforced by `architecture/structure` under `pnpm lint` (in-editor + CI). Each node carries a didactic `message` telling you _what to do_. To add a genuinely new file kind or stereotype, declare it there — deliberately, not by working around the check.

The taxonomy asks three separate questions, and which one you are answering decides which field on the node you touch:

| Question                                    | Where                                              |
| ------------------------------------------- | -------------------------------------------------- |
| Is this folder part of the taxonomy at all? | the folder's own key under its parent's `children` |
| Which basenames does this folder admit?     | that folder node's `children`                      |
| Which siblings does this file owe?          | `requires` on the file node                        |

An exemption is a `requiresNot` on the file node that would otherwise owe the sibling — the `login`/`logout` endpoints are the only ones.

**Parity.** If you create any of these without its sibling, `pnpm lint` fails:

| When you create…                            | Write a sibling…                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `domain/*.root.ts`                          | `domain/<base>.root.test.ts` (aggregate roots; the non-root domain stereotypes need none)                   |
| `domain/*.domain-service.ts`                | `domain/<base>.domain-service.test.ts`                                                                      |
| `commands/*.handler.ts`                     | `commands/<base>.handler.test.ts` (the test sits on the handler, over fakes + `PassThroughUnitOfWork`)      |
| `queries/*.handler.ts`                      | `queries/<base>.handler.integration.test.ts` (queries read real SQL — the parity is the integration test)   |
| `event-handlers/*.handler.ts`               | `event-handlers/<base>.handler.test.ts`                                                                     |
| `interface/{http,cli}/*.endpoint.ts`        | `<base>.endpoint.integration.test.ts` (login/logout OIDC endpoints are exempted — see Endpoint test naming) |
| `interface/{http,cli}/*.util.ts`            | `<base>.util.test.ts` (the test obligation is the anti-drift guard — ADR-0023)                              |
| `interface/events/*.event-adapter.ts`       | `interface/events/<base>.event-adapter.test.ts`                                                             |
| `domain/ports/repositories/*.repository.ts` | in `infrastructure/repositories/`: `<base>-live.ts` + `<base>-fake.ts` + `<base>-live.integration.test.ts`  |
| `domain/ports/clients/*.client.ts`          | in `infrastructure/clients/`: `<base>-live.ts` + `<base>-fake.ts` + `<base>-live.test.ts`                   |
| `domain/ports/acl/*.acl.ts`                 | in `infrastructure/acl/`: `<base>-live.ts` + `<base>-fake.ts` + `<base>-live.test.ts`                       |
| module root `<feature>.command-handlers.ts` | `<feature>.handlers.test.ts` calling `assertHandlersCover` for commands and queries                         |

Adapter parity is anchored on the **port** (not the adapter), so a port and its adapters share a base name. The naming conventions are the parity detectors — don't rename a file to dodge the rule, write the test.

**Layout.** Each stereotype folder admits a closed set of file kinds (ADR-0008); an unrecognized source file fails. A Nest-flavoured name — `todos.controller.ts`, `todos.service.ts`, `create-todo.dto.ts` — is unrecognised like any other stray. **Container folders** (`domain/ports/`, `infrastructure/`, `interface/`) admit no direct files. Subfolders are allowlisted too: a module admits only `domain/ commands/ queries/ event-handlers/ sagas/ infrastructure/ interface/ policies/`.

**Concessions** (ADR-0008): there is no commands/queries "pair rule" — deny-by-default blocks stray-named files, and an orphan handler still owes its test and fails `assertHandlersCover`. A completely empty stray folder is never visited, so it escapes.

**Every rule carries a `probe`** — a path it must reject — and the plugin refuses to load if any rule fails its own.
