# Rule: the legacy API

**Scope:** `packages/legacy-api/` — read before touching the hapi server.

It is a facsimile of a long-lived production hapi codebase, kept deliberately in that shape so the strangler campaign has something real to measure. The conventions below are the opposite of the Nest server's on purpose. Do not "improve" it toward the hexagonal layout; a module leaves this package by being rebuilt on the Nest server, never by being refactored in place.

- **Layout.** `src/application/<feature>/` holds `<feature>-routes.ts` (hapi route arrays), `<feature>-service.ts` (a class or a bag of functions with the business logic), `<feature>-model.ts` (bookshelf models) and `<feature>-access.ts` (ACL assertions). `src/lib/` holds shared helpers. `src/bin/` holds process entrypoints. `migrations/` and `seeds/` are knex, all tables in `public`.
- **Wiring is electrolyte.** A module the container loads uses `export =` so the module _is_ the factory function or class, and declares its dependencies as string ids: `factory["@require"] = ["bookshelf", "user/user-service"]`, `factory["@singleton"] = true`. A function whose name starts lowercase is called as a factory; a class (uppercase) is `new`ed. `bootstrap.ts` lists the route factories it creates. No import graph sees these edges, which is the point.
- **Language.** TypeScript compiled as CommonJS, `noImplicitAny: false`. `any`, deep relative imports and sloppy booleans are tolerated here by an override in `.oxlintrc.json`; import sorting and the correctness rules still apply.
- **Permissions leak on purpose.** `can(action, resourcePath)` pre-handlers from `src/lib/access/`, `fromOwn*`-style pre-handlers and inline role checks inside route files, one-off permission helpers. That is the smell; keep it consistent rather than fixing it.
- **Transactions** are `bookshelf.transaction(async (t) => …)` in services with `{ transacting: t }` threaded through; the wallet HTTP call sits inside one, and compensation is a best-effort delete afterwards.
- **It never imports Nest code.** Not `@org/server`, not `@org/database`, not the kernel packages; the root graph rules refuse it. It shares the database and the HTTP contracts, nothing else.
- **Tests.** `*.spec.ts` beside a service are unit tests over mocks (`vi.mock` the collaborators). `test/**/*.integration.test.ts` compose the real server through `test/server.ts` and drive it with `server.inject` against `DATABASE_URL_TEST`; `test/setup.ts` installs the tsx require hook the container needs to load TypeScript. `test/health-check.test.ts` is the one composed-server test that needs no database.
- **Run.** `pnpm -F @org/legacy-api dev` on `:9000`; the web proxy points here. `pnpm dev` starts it with the Nest server and the web.
