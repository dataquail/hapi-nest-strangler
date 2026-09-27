# ADR-0022: Cross-module outbound ports and the clients/acl adapter taxonomy

- Status: Accepted
- Date: 2026-05-26
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

ADR-0006 gives modules typed command/query buses, and ADR-0007 a domain-event bus whose subscriptions choose whether they run inside the publisher's transaction or after it commits. Together they are the only sanctioned channels for one module to affect another. ADR-0007 also establishes an anti-corruption layer for the _inbound_ direction: a consumer reads a foreign event at a single adapter in `interface/events/`.

The _outbound_ direction needs equivalent discipline. When a module needs another module to do something — fire a command, answer a query — nothing should let any file in the consuming module import the publisher's surface, construct the message, and dispatch it on the bus. That allow-by-default admits two kinds of leakage:

- **Message shape.** A consumer that constructs `new GrantRoleCommand({ role: "super_admin", actorUserId, userId })` is coupled to that field set.
- **Error vocabulary.** Because the bus is typed (ADR-0006), the foreign command's `E` union rides along with the message's result type. A consumer that dispatches it inherits the publisher's domain error tags and switches on them in its own interface layer.

A second pressure: outbound counterparts are not all the same kind. A **true third-party system** (Stripe, an email provider, the Zitadel OIDC endpoint) is reached over the network and needs secrets, timeouts, signature verification; the anti-corruption obligation is against a vendor's API. **Another bounded context inside this monolith** is an in-process call today and a network hop if the module is ever extracted; the obligation is against a sibling's domain vocabulary.

## Decision

### Consumer-owned outbound port

A module that calls another module does so through a **consumer-owned outbound port**. Two collaborating files per (consumer, capability):

- A **port** in `domain/ports/acl/<capability>.acl.ts` — an abstract class whose method signatures and error types are expressed entirely in the consumer's own vocabulary. The port names a capability ("is this user a platform super-admin"), not a publisher ("the role module").
- An **adapter** in `infrastructure/acl/<capability>.acl-live.ts` — the live. This is the _only_ file in the consuming module, beside `interface/events/`, permitted to name the publisher's vocabulary — and it does so through its own module's `<feature>.imports.ts` gateway, never a foreign surface directly (ADR-0032). It dispatches on `AppQueryBus` / `AppCommandBus` and maps the publisher's results and errors back into the port's own types.

```ts
@Injectable()
export class PlatformRolesLive extends PlatformRoles {
  constructor(@Inject(AppQueryBus) private readonly queries: AppQueryBus) {
    super();
  }

  public async isSuperAdmin(userId: UserId): Promise<Result<boolean, PersistenceUnavailable>> {
    const roles = await this.queries.execute(new roleAccessQueries.FindUserRolesQuery({ userId }));
    return roles.map((view) => view.roles.includes("super_admin"));
  }
}
```

Commands, queries, domain, policies and interface code all depend on the port. The module's `<feature>.module.ts` binds the port to its live with `{ provide: PlatformRoles, useClass: PlatformRolesLive }` and imports the publisher's Nest module so the dispatched message has a handler at runtime (ADR-0032).

### Port and adapter taxonomy: three buckets by counterpart

| Counterpart                | Port                                 | Adapter                        | May name a foreign module's vocabulary   |
| -------------------------- | ------------------------------------ | ------------------------------ | ---------------------------------------- |
| The module's own datastore | `domain/<subdomain>/*.repository.ts` | `infrastructure/repositories/` | no                                       |
| A true third-party system  | `domain/ports/clients/`              | `infrastructure/clients/`      | no                                       |
| Another bounded context    | `domain/ports/acl/`                  | `infrastructure/acl/`          | **yes** — through `<feature>.imports.ts` |

`infrastructure/repositories/` holds the `*.repository-live.ts` / `*.repository-fake.ts` / `*.mapper.ts` trio (ADR-0005). `infrastructure/clients/` holds port-backed vendor adapters (`*.client-live.ts` + `*.client-fake.ts`), self-contained clients with no port (`oidc.client.ts`), and template components (`*.email.tsx`). `infrastructure/acl/` holds the anti-corruption adapters to sibling modules (`*.acl-live.ts` + `*.acl-fake.ts`).

### The bucket is the seam that makes a module relocatable

A port's contract says nothing about who fulfils it. Extracting a module into its own service is a _pure adapter swap_: the `acl/` adapter changes from "dispatch the sibling's query" to "make an HTTP request"; the port and every consumer upstream of it are untouched. `infrastructure/clients/` is **not** allowed to name a foreign module — a "client" that reaches into a sibling is a miscategorised ACL.

### The `domain/`-resident port guarantee

Placing the ACL port in `domain/ports/acl/` is load-bearing. The domain's allowlist (ADR-0008) admits only `zod`, `oxide.ts`, `platform/ids` and `platform/ddd/contracts`. A port defined there therefore _cannot_ reference the publisher's message classes or error types — the rule rejects it. The abstraction is provably consumer-owned, mechanically.

### Error translation

The port declares its own errors as tagged classes in `domain/` (ADR-0004). The adapter maps the publisher's errors to the port's by switching on `_tag` — the exact mirror of what an HTTP endpoint does, opposite direction:

```ts
const created = await this.commands.execute(new userAccessCommands.CreateUserCommand({ email }));
if (created.isOk()) return created;
const error = created.unwrapErr();
return error._tag === "UserAlreadyExists"
  ? Err(new UserProvisioningConflict({ email }))
  : Err(error);
```

Because the bus is typed, the publisher's full error union is visible at the dispatch site inside the adapter; when the publisher adds a failure mode it surfaces there.

### Policies use this pattern too — there is no platform ACL tier

Cross-module data needed by **policies** goes through the same consumer-owned port. A check closes over its module's own port at registration (ADR-0021), so every registered check has no ambient dependency. Membership is asked identically by three modules; we accept three near-identical ports rather than one shared service, because the boundary and the extraction cost matter more than the duplication. Do not "fix" that duplication by re-extracting a shared helper.

### The supplier side: published policy-queries

The owning module publishes a **`queries/*.policy-query.ts`** — an ordinary read-side query, marked by its stereotype as a cross-module authorization contract with a stability obligation a plain `*.query.ts` does not have. It is exported through the module's `<feature>.exports.ts` as part of `<module>AccessQueries` (ADR-0032). A consumer's `acl/` adapter dispatches it and narrows the result into the port's vocabulary — a role-name list becomes the single boolean `isSuperAdmin`.

### Authorization now reads the read side

A policy check and a resource resolver read **read models**, never aggregates. Reads join the caller's ambient transaction, so a check during a command's authorization sees that command's uncommitted state. **A query backing an authorization decision must never be served from a replica or a projection.**

## Enforcement

- `architecture/imports` (`packages/server/architecture.yaml`) forbids any file under `modules/<m>/` from naming another module's surface, except `infrastructure/acl/**` and `interface/events/**`, and those only through their own `<feature>.imports.ts` (ADR-0032). `clients/` is intentionally excluded.
- `architecture/structure` admits the closed set of file kinds per tier folder and requires each port's `-live` / `-fake` / test siblings under the matching `infrastructure/` tier. Anchoring parity on the port means a self-contained client with no port is not required to have a live/fake.
- The ACL ports are admitted to commands, queries, `infrastructure/`, `policies/` and `domain/` — and to nothing else. `interface/` is deliberately excluded: an endpoint needing a foreign fact dispatches a query whose handler owns the port.
- `policies/` is barred from the write-side consistency boundary and admits its own `queries/`, its own `acl/` port, its own branded ids, `platform/auth/authz.ts`, `platform/ddd/` and `platform/ids/`.

## Consequences

- A module's would-be-network dependencies are auditable in exactly one folder (`acl/`), separate from its vendor integrations (`clients/`) and its own persistence (`repositories/`).
- Publisher message-shape and error-vocabulary changes are absorbed in a single adapter per (consumer, capability) pair.
- Consumer use cases test against a small fake port (`PlatformRolesFake` takes the set of super-admin ids in its constructor) rather than a bus fake.
- The cost is real: one port file, one live, one fake, one live test and the error-mapping code per capability.

## Supersedes / differs from the Effect edition

A `Context.Service` port → an abstract class the module binds with `useClass`; a per-module dispatch surface (`Command.subsetOf`) → the one `AppQueryBus`/`AppCommandBus` plus the `<feature>.imports.ts` discipline the manifest holds the adapter to; `Effect.catchTag` → an `_tag` switch on the `Err`. The taxonomy and the reasons are unchanged.

## Alternatives considered

- **Leave outbound calls direct.** Rejected — the asymmetry with the inbound event ACL has no principled defence.
- **Define the ACL port next to its adapter in `infrastructure/`.** Rejected — loses the `domain/` allowlist guarantee.
- **A single `external/` bucket for both third-party and sibling-context.** Rejected — hides which adapters are network-hop candidates.
- **Nest's `forwardRef` / shared providers instead of ports.** Rejected — a shared provider is the platform ACL tier this ADR withdrew, expressed in DI.

## Related

- ADR-0002, ADR-0004, ADR-0006, ADR-0007, ADR-0008, ADR-0020, ADR-0021, ADR-0032.
