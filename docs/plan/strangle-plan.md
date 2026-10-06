# Strangle the hapi API into the Nest server

Required reading, and authoritative, for any work on `packages/legacy-api` or on moving a module out
of it. Where this plan and an older document disagree, this plan wins. Keep the [Status](#status)
section current as you work.

## Why

Every module but the wallet still lives on the hapi server, in the shape of a long-lived codebase:
services reaching each other directly, permission checks in route files, bookshelf models over one
`public` schema. Each module leaves by being **rebuilt on the Nest server**, never by being
refactored in place on hapi. The hapi package stays in its legacy shape until a module is gone from
it (`.claude/rules/legacy-api.md`); what changes is how much of it is left.

There are five modules to move, called **sectors** here: `user`, `auth`, `organization`, `todo` and
`billing`. Everything else in the hapi package (`src/lib`, `bootstrap.ts`, the plugins, the
container wiring) is the substrate: it is not moved, and it goes when the last sector has gone.

## How

Move one sector at a time through the phases below, in order. A phase is reached when every
condition listed under it is true of the code; the backfill phase is reached when the backfill has
been run and recorded. Each condition comes with how to make it true.

Rules that hold in every phase:

- **One step per layer.** Build the work as a stack of reviewable layers, each one change a reviewer
  can approve or reject on its own. Paying down an existing problem goes in its own commit, not
  folded into a feature change.
- **Phases in order.** Do not do a later phase's work while an earlier phase's conditions are still
  unmet. In particular, nothing is served by the Nest server before the backfill is recorded, and
  no legacy write is deleted before the route that reached it is proxied. Deleting hapi code the
  sector no longer needs is never early.
- **Leave what you touch no worse.** A change in a sector's files adds no new instance of anything a
  phase has to remove: no new reach into a sibling module, no new role check in a route file, no
  unmirrored write once the sector is mirroring, no local route handler once it is being served,
  no new legacy write once it is served. This holds for every contributor, including one adding a
  feature to a module mid-migration: a new legacy write or route is mirrored, backfilled and moved
  like the rest.
- **The hapi server only shrinks.** The non-blank lines of production code under
  `packages/legacy-api/src/` go down, never up, except in the mirrored phase, where every write
  gains a forward by design. A fix elsewhere may add a handful of lines (about twenty); more than
  that is the count going the wrong way.
- **The strangling's own scaffolding is shared.** The backend client
  (`src/lib/backend-client/*.ts`), `proxyToNest` (`src/lib/backend-client/proxy-to-nest.ts`), the
  mirror plugin (`mirror-event-handler-plugin.ts`) and its event constants
  (`src/constants/mirror-events.ts`) belong to no sector. Each sector that needs them restores them
  (they left with billing, their last user), and they go again with the last sector using them.
- **A stalled sector is a decision.** A sector parked mid-phase for more than thirty days needs an
  explicit decision to resume or to stop, written in its Status entry.
- **The end.** When every sector is settled, this plan and the scaffolding above are deleted.

## The phases

### 1. fenced

_The module names no sibling module: what it needs from a peer arrives through the substrate, and
its role checks live in its access file, not its routes._

- **No reach into a sibling module.** No file under `src/application/<m>/` (specs aside) imports a
  file from another module's folder (`../user/…`) or names another module's factory in its
  `@require` list (`"user/user-service"`).
  _How:_ reach the peer through the substrate — a port under `src/lib` the container wires — not by
  importing its folder or naming its factory id.
- **No role checks in route files.** No route file calls `isSuperAdmin()`, `isMemberOf(…)` or
  `isAdminOf(…)`.
  _How:_ a route asks the ACL with `can(action, resource)`; the membership or role assertion belongs
  in the module's access file.

### 2. rebuilt

_The module exists on the Nest server in the hexagonal layout, with hapi still serving its routes._

- **The Nest module exists.** `packages/server/src/modules/<m>/<m>.module.ts` exists.
  _How:_ rebuild the module under `packages/server/src/modules/` with its taxonomy and tests
  (`.claude/rules/server-module-layout.md`, `server-file-taxonomy.md`), its own Postgres schema and
  migrations in `@org/database`.

### 3. mirrored

_Every write the legacy module takes is forwarded to the Nest module's internal API, so the Nest
table fills as a replica while hapi stays the source of truth._

The hapi module grows here by design: every write gains a forward.

- **The Nest module has an internal write API.** An endpoint under
  `packages/server/src/modules/<m>/interface/http/` is guarded by `InterServiceAuthGuard`.
  _How:_ give the Nest module an internal write API behind the inter-service guard, so the legacy
  module can forward each write to it; it goes again once the Nest module serves the routes itself
  (from the served phase on, it may be retired).
- **Every legacy write is mirrored.** Every knex `insert`, `update` or `del` in the module's service
  files sits in a method that emits a `mirrorEvents.*` event.
  _How:_ emit the module's mirror event from the same service method once the row is written; the
  mirror plugin forwards it to the Nest module's internal API through
  `src/lib/backend-client/domains/<m>.ts`, so the Nest table receives what hapi wrote.
- **A mirror never announces a row that may not be written.** No `mirrorEvents.*` emit comes before
  the write it announces.
  _How:_ move the mirror emit below the write it announces (after the transaction, when the write is
  inside one), so a failed write sends nothing to the replica.

### 4. backfilled

_The Nest table has been backfilled from the legacy table once, after every write was mirrored. No
check of the code can see a script run, so whoever ran it records it._

- **The backfill exists.** A one-shot backfill in `@org/database` — `db:backfill:<m>`, with its
  integration test — upserts every legacy row into the Nest tables and deletes replica rows the
  legacy side no longer has. It is written with the sector and deleted in the data-moved phase.
  _How:_ follow the shape of the earlier backfills (`git log --grep 'backfill'`); it must be
  idempotent, so a second run upserts the same rows and deletes nothing.
- **The backfill has been run and recorded.** It has been run against the development database
  (migrated by both migrators and seeded) after every write was mirrored, and its output is
  recorded in the sector's backfill line in [Status](#status).
  _How:_ run it, run it a second time, keep both outputs, then write the backfill line exactly as
  described in [The backfill record](#the-backfill-record). Never tick it before the run.

### 5. served

_The Nest module answers: hapi's routes forward to it operation by operation, and the legacy service
writes nothing itself any more._

- **The Nest module has user-facing endpoints.** An endpoint under
  `packages/server/src/modules/<m>/interface/http/` is guarded by `UserAuthGuard`.
  _How:_ give the Nest module its user-facing endpoints behind the user guard, with the policies that
  authorize them.
- **No route is served locally.** Every route definition in the module's route files has
  `handler: proxyToNest(...)`.
  _How:_ replace this route's handler with `proxyToNest(...)`, so hapi forwards the operation to the
  Nest module instead of serving it.
- **The legacy service writes nothing.** No knex `insert`, `update` or `del` remains in the module's
  service files.
  _How:_ the Nest module is the source of truth now: delete this write and the forward beside it; the
  route that reached it is a proxy.
- **Write operations that share rows leave hapi together.** Once one is served by the Nest server,
  the rows it writes stop reaching the legacy table the others still use, so no shared-state group
  is part proxied, part local.
  _How:_ proxy every operation of a group in the same change, or none: a group part served by hapi
  and part forwarded to the Nest server loses writes between the two tables. The groups are listed
  per sector under [Per-sector notes](#per-sector-notes); a group that names an operation its route
  file no longer has, or misses one the file has gained, is out of date and is fixed first.

Order within the phase: **reads first**, each in any order, once the backfill is recorded (the
replica is complete and every local write still reaches it); then each shared-state group in one
layer; then the deletion of the legacy writes, the service, the access file and the module's mirror
wiring with the last proxied route.

### 6. routes-moved

_The web proxy sends the module's routes to the Nest server and the hapi routes are deleted._

- **No hapi route files.** No route file remains under `src/application/<m>/`.
  _How:_ point the web proxy at the Nest server for these paths (one entry in
  `packages/web/services/api/upstreams.shared.ts` and its rewrite in `next.config.ts`), delete the
  hapi route file, and move the groups out of `test/route-parity.test.ts`'s hapi side.

### 7. data-moved

_The module's tables belong to its Nest schema, the legacy table is dropped by a legacy migration,
and the bookshelf models are gone._

- **No bookshelf models.** No `*-model.ts` remains under `src/application/<m>/`.
  _How:_ move the table into the module's Nest schema and delete the bookshelf model.
- **The legacy table is dropped.** A legacy migration `packages/legacy-api/migrations/<n>_drop_…`
  exists for the module's tables.
  _How:_ write a legacy migration that drops the module's table, now that nothing on hapi reads or
  writes it; the Nest table is the only copy. The backfill goes in the same step.

### 8. gone

_Nothing of the module remains in the hapi package but its migration history._

- **No hapi files.** Nothing under `packages/legacy-api/` belongs to the module except its
  migrations.
  _How:_ delete what is left of the module in the hapi package; the migrations stay.

### 9. settled (open)

_Decide what the module's departure leaves in the substrate — its ACL entries, its container ids,
the shared `public` tables — and whether the substrate itself is next._

There is no condition to meet. Write what the departure leaves, on both servers, in the sector's
Status entry.

## Conventions per module

From `.claude/rules/legacy-api.md`, which governs the hapi package:

- **The legacy shape stays.** `src/application/<m>/` holds `<m>-routes.ts`, `<m>-service.ts`,
  `<m>-model.ts` and `<m>-access.ts`; wiring is electrolyte (`export =`, `@require` ids). Do not
  improve it toward the hexagonal layout. Do not name a hapi file `*-fake.ts`.
- **Transactions** are `bookshelf.transaction(async (t) => …)` with `{ transacting: t }` threaded
  through.
- **Dual-write (mirrored).** The service emits a `mirrorEvents.*` server event once the row is
  written, after the transaction commits; the mirror plugin forwards it to the Nest module's
  internal API through `backend-client/domains/<m>.ts`. A failed forward is logged, never raised.
- **Backfill.** A one-shot `db:backfill:<m>` in `@org/database` squares the replica once, written
  with the module and deleted at data-moved. It also carries anything the replica has never
  received through a forward (billing's carried the claimed webhook events).
- **Cutover (served).** Each route's handler becomes `proxyToNest()`: the request goes to the Nest
  server as it arrived, with the caller's own cookie or bearer, and the answer is relayed. A proxied
  route checks no session and parses nothing. The service, access file and the module's mirror
  wiring go with the last proxied route; the route files stay until the web proxy points at the
  Nest server.
- **The seam.** `src/lib/backend-client/` is the only file that names the Nest server's URL and the
  inter-service token. Hapi never imports Nest code (`@org/server`, `@org/database`, the kernel
  packages).
- **Tests.** Service `*.spec.ts` over stubs; `test/**/*.integration.test.ts` drive the composed
  server with `server.inject`, with `test/helpers/fake-wallet-server.ts` standing in for the Nest
  server. `test/route-parity.test.ts` holds both servers' route tables to the contracts.
- **Precedent.** Todo and billing went through every phase; `git log --grep 'todo\|billing'` shows
  one layer per step.

## Per-sector notes

### organization

**Shared-state group.** In the served phase a proxied route writes the Nest module's tables only,
while a route hapi still serves writes the legacy table and mirrors it forward; nothing flows back
through the mirror. Two write operations must therefore flip together when one writes rows the
other reads or writes. Organization lifecycle shares `organizations` rows; create also inserts the
creator's membership and admin role; accept updates the invitation and inserts a membership; remove,
leave, promote and demote share `memberships` and `organization_roles`. Create and accept join the
tables, so every write is in one group:

- **`organization-writes`** (all in `organization-routes.ts`), flipped in one layer:
  `POST /orgs`, `DELETE /orgs/{id}`, `POST /orgs/{id}/restore`, `POST /orgs/{orgId}/invitations`,
  `DELETE /orgs/{orgId}/invitations/{invitationId}`,
  `POST /orgs/{orgId}/invitations/{invitationId}/resend`, `POST /invitations/{token}/accept`,
  `DELETE /orgs/{orgId}/members/{userId}`, `POST /orgs/{orgId}/leave`,
  `POST /orgs/{orgId}/members/{userId}/admin`, `DELETE /orgs/{orgId}/members/{userId}/admin`.
- Any write route added to the module later that touches these tables joins the group.

**Reads first.** Once the backfill is recorded, and before the group, these flip in any order among
themselves: `GET /orgs`, `GET /orgs/{orgId}/invitations`, `GET /orgs/{orgId}/members`,
`GET /admin/orgs` (in `organization-routes.ts`) and `GET /cli/orgs` (in
`organization-cli-routes.ts`).

**Readers outside the sector.** Hapi's session strategy preloads every user's `memberships` and
`organization_roles` (`user-service.ts`), and hapi's `can(...)` checks read them for every module
still on hapi. On the Nest side, the todos and billing ACL adapters read `public.memberships` and
`public.organization_roles`. Once the group is proxied, membership, role and organization changes
reach the Nest module's tables and not the legacy ones, so all of those readers would go stale.
Flipping the group together does not solve this. Two rules:

- **Hapi-side readers: a reverse forward.** From the write flip until the hapi readers leave (user
  and auth move), the Nest organization module forwards each change to organizations, memberships
  and organization roles back to hapi after it commits: an after-commit subscription calling an
  internal write API on hapi behind the inter-service token. It is the mirror image of the
  dual-write: hapi writes its own tables, and Nest never writes `public`. The reverse forward is in
  place, with its tests, **before** any operation of `organization-writes` is proxied. It is
  scaffolding and goes at data-moved.
- **Nest-side readers: switch to the Nest module.** The todos and billing ACL adapters ask the
  organization module's policy query instead of reading `public`. They switch after the backfill is
  recorded, when the replica is complete, and no later than the layer that proxies the group. Once
  the group is proxied, no Nest module reads `public.organizations`, `public.memberships` or
  `public.organization_roles`.

**The wallet seam.** `createOrganization` opens the wallet over HTTP inside its transaction; a
refusal rolls back (`502`), a failure after the wallet opened deletes it again. The wallet is
already a Nest module. A mirrored create must not open a second wallet, and once create is served
by the Nest server, the wallet opens there.

**Beyond routes-moved.** Organization's data-moved depends on user and auth leaving hapi: the
session strategy and those modules read the organization tables.

### billing

**Shared-state group.** `subscription-lifecycle` (all in `billing-routes.ts`):
`POST /orgs/{orgId}/billing/subscriptions`, `DELETE /orgs/{orgId}/billing/subscriptions/current`,
`POST /webhooks/stripe`. The read `GET /orgs/{orgId}/billing/subscriptions/current` flipped first.

### user, auth, todo

No shared-state groups declared. Before user or auth reaches served, work out its groups from the
code the same way and write them here first.

## The backfill record

Each sector has exactly one backfill line in its Status checklist. Its form is fixed, so it can be
read mechanically; write it on one line, with nothing before the dash:

```
- [ ] Backfill run (<sector>): not yet run.
- [x] Backfill run (<sector>): YYYY-MM-DD — <command> (commit <sha>) run against <database> after every write was mirrored: <what the first run did>; a second run <what it did>.
```

- `<sector>` is the sector's name in lower case; the date is the day of the run, ISO format,
  followed by a space, an em dash and a space.
- The evidence names the command, the commit it ran from, the database, and both runs' counts
  (upserted and deleted per table).
- Tick it only after the run, in a layer of its own. If a write is later found that was not mirrored
  when the backfill ran, untick it (`[x]` back to `[ ]`, evidence replaced by `not yet run.`),
  mirror the write, and run and record the backfill again before anything else is served.

## Status

Kept current by whoever changes a sector: update the checklist in the same commit as the change
that makes an item true, and tick only what the code shows. A phase is reached when all its items
are ticked.

### organization

- fenced
  - [ ] No reach into a sibling module — `organization-service.ts` imports `../user/user-service`
        and names `user/user-service` in its `@require` list.
  - [ ] No role checks in route files — `organization-routes.ts` has one.
- rebuilt
  - [ ] The Nest module exists.
- mirrored
  - [ ] The Nest module has an internal write API.
  - [ ] Every legacy write is mirrored.
  - [ ] No mirror emit precedes its write.
- backfilled
  - [ ] The backfill exists, with its test.
- [ ] Backfill run (organization): not yet run.
- served
  - [ ] The Nest module has user-facing endpoints.
  - [ ] Reads proxied: `GET /orgs`, `GET /orgs/{orgId}/invitations`, `GET /orgs/{orgId}/members`,
        `GET /admin/orgs`, `GET /cli/orgs`.
  - [ ] Nest-side readers ask the organization module, not `public`.
  - [ ] The reverse forward to hapi is in place, with its tests.
  - [ ] `organization-writes` proxied, in one layer.
  - [ ] No route is served locally.
  - [ ] The legacy service writes nothing.
- routes-moved
  - [ ] No hapi route files; the web proxy sends the paths to the Nest server.
- data-moved
  - [ ] No bookshelf models.
  - [ ] The legacy tables are dropped.
- gone
  - [ ] No hapi files.
- settled
  - [ ] What the departure leaves is written here.

### user

- fenced
  - [x] No reach into a sibling module.
  - [x] No role checks in route files.
- rebuilt
  - [ ] The Nest module exists (`user`, with `role`).
- mirrored
  - [ ] The Nest module has an internal write API.
  - [ ] Every legacy write is mirrored.
  - [ ] No mirror emit precedes its write.
- backfilled
  - [ ] The backfill exists, with its test.
- [ ] Backfill run (user): not yet run.
- served
  - [ ] Shared-state groups written under Per-sector notes.
  - [ ] The Nest module has user-facing endpoints.
  - [ ] No route is served locally.
  - [ ] The legacy service writes nothing.
- routes-moved
  - [ ] No hapi route files; the web proxy sends the paths to the Nest server.
- data-moved
  - [ ] No bookshelf models.
  - [ ] The legacy tables are dropped.
- gone
  - [ ] No hapi files.
- settled
  - [ ] What the departure leaves is written here.

### auth

- fenced
  - [ ] No reach into a sibling module — `auth-service.ts` and `session-scheme.ts` each import
        `../user/user-service` and name `user/user-service` in their `@require` lists.
  - [ ] No role checks in route files — `auth-routes.ts` has one.
- rebuilt
  - [ ] The Nest module exists.
- mirrored
  - [ ] The Nest module has an internal write API.
  - [ ] Every legacy write is mirrored.
  - [ ] No mirror emit precedes its write.
- backfilled
  - [ ] The backfill exists, with its test.
- [ ] Backfill run (auth): not yet run.
- served
  - [ ] Shared-state groups written under Per-sector notes.
  - [ ] The Nest module has user-facing endpoints.
  - [ ] No route is served locally.
  - [ ] The legacy service writes nothing.
- routes-moved
  - [ ] No hapi route files; the web proxy sends the paths to the Nest server.
- data-moved
  - [ ] No bookshelf models.
  - [ ] The legacy tables are dropped.
- gone
  - [ ] No hapi files.
- settled
  - [ ] What the departure leaves is written here.

### todo

- [x] fenced · rebuilt · mirrored
- [x] Backfill run (todo): 2026-10-01 — db:backfill:todos run against the shared database after every todo write was mirrored: 2 upserted, 1 deleted; a second run upserted the same 2 and deleted 0.
- [x] served · routes-moved · data-moved · gone
- [x] Settled 2026-10-01. What the departure leaves: in hapi, the `TODO` entry in
      `constants/acl/resource-constants.ts` and the todo migrations and the drop; in the Nest
      server, the ACL adapters reading `public.memberships` and `public.roles` and the legacy row
      schemas they use, the authenticator over `public.sessions` and `public.api_tokens`, the test
      seeds for legacy rows, and the todos schema's missing FK to organizations. All of it goes when
      organization, role and auth move.

### billing

- [x] fenced · rebuilt · mirrored
- [x] Backfill run (billing): 2026-10-05 — db:backfill:billing (commit 90c2a22) run against hapi-strangler-dev, migrated by both migrators, after every billing write was mirrored: the legacy side held 2 subscriptions and 3 claimed webhook events the replica had never received; the run upserted 2 and 3 and deleted 0, and a second run upserted the same and deleted 0.
- [x] served · routes-moved · data-moved · gone
- [x] Settled 2026-10-05. Left in hapi: the `MANAGE_BILLING` action and `SUBSCRIPTION` resource
      constants, the organization assertions moved to `src/lib/access` at fenced (organization's to
      take), and the billing migrations and the drop. Left in the Nest server: the billing ACL
      adapters reading `public.memberships`, `public.organization_roles` and `public.roles` with
      the legacy row schemas they use, the legacy-row test seeds, and `billing.subscriptions`'
      missing FK to organizations; all of it goes when organization and role move. Outside the
      repo: Stripe's webhook endpoint must point at the gateway's `/api/webhooks/stripe`. The
      shared scaffolding left with billing's last use; the next sector restores it.
