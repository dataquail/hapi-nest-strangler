# Rule: Nest / CQRS / toolchain gotchas

**Scope:** all packages — read when something compiles but fails at bootstrap, lints but does not type-check, or type-checks but does not lint. Each entry is a behaviour of the stack that shaped a file's placement or shape; ADR-0033 records why.

## Nest

- **A guard named in `@UseGuards()` is evaluated at decoration time.** Controller classes are decorated when their module file loads, so a guard that (transitively) imports a module whose endpoints name the guard is `undefined` in that cycle and Nest throws `Invalid guard passed to @UseGuards() (XEndpoint)`. `UserAuthGuard` depends on the `Authenticator` **port** (`platform/auth/authenticator.ts`); only `AuthenticatorLive` imports the auth module. Never import `modules/**` from `platform/middlewares/user-auth.guard.ts` or anything it imports.
- **Root-module providers are not global.** A provider in `AppModule` is invisible to a feature module (`Nest can't resolve dependencies of X (?, …)`). Cross-cutting services are `@Global()` modules: `CqrsRuntimeModule`, `AuthzModule`, `BillingGatewayModule`, `DatabaseModule`, `EnvModule`, `NotificationsModule`. Everything else is imported per module in `<feature>.module.ts`.
- **No `emitDecoratorMetadata`.** Constructor parameter types are not reflected; `@Inject(Token)` on every parameter, or the provider is `undefined` at runtime with no error until first use.
- **DI tokens are abstract classes.** `abstract class XRepository` is the port and the token; the live `extends` it and is bound with `{ provide: XRepository, useClass: XRepositoryLive }`. A type from a library becomes a token by declaration merging: `interface Database extends DatabaseClient {}` + `abstract class Database {}`.
- **`forwardRef` is forbidden.** A module cycle is a design error, not a wiring problem.
- **`Test.createTestingModule` overrides by token** (`overrideProvider(Database).useValue(…)`, `overrideGuard(UserAuthGuard).useClass(UserAuthGuardFake)`); the test root and `main.ts` share `AppModule` verbatim.
- **`@Caller()` outside `@UseGuards(UserAuthGuard)` throws** — the decorator reads `request.currentUser`, and only the guard sets it. `AuthenticatedRequest.currentUser` is typed `CurrentUser | undefined` explicitly because the project uses `exactOptionalPropertyTypes`.

## `@nestjs/cqrs`

- **Messages carry their result type as a phantom**: `class XCommand extends Command<XResult>`; `bus.execute(cmd)` returns `Promise<XResult>`. Declare `XResult` as an explicit alias — TypeScript will not infer `Result<A, E1 | E2>` from the branches of a handler.
- **`@CommandHandler` / `@QueryHandler` stamp `__commandHandler__` / `__queryHandler__` metadata**, which `assertHandlersCover` (`platform/cqrs/messages.ts`) reads. The keys are not exported by the package; if a bump renames them the handler tests fail loudly on every module.
- **Nest's bus opens no spans.** Inject `AppCommandBus` / `AppQueryBus`; the span name is `command.<ClassName>` and the attribute extractor is looked up by `command.constructor.name` — minified or renamed classes lose their attributes.
- **`EventBus`, `EventsHandler`, `Saga`, `ofType`, `IEvent`, `IEventHandler` are refused by the manifest**; `publish` is fire-and-forget over RxJS and cannot join or await the publisher's transaction. Use `DomainEventBus` (`@org/event-bus`).
- **`CqrsModule.forRoot()` is imported once**, in `CqrsRuntimeModule`, which is global. A feature module never imports `CqrsModule` itself.

## Result and errors

- **`oxide.ts` `Result` is a class instance.** `expect(result.unwrapErr()).toEqual(new TodoNotFound({...}))` compares instances; to compare against a plain object spread it: `expect({ ...result.unwrapErr() }).toEqual({ _tag: "TodoNotFound", todoId })`.
- **`TaggedError("X")` returns a class factory.** It must be extended (`class X extends TaggedError("X")<Props> {}`); it does not extend `Error`, so `instanceof Error` is false and a tagged error must be **returned**, not thrown.
- **The unit of work inspects the return value.** `run` rolls back when the block returns an `Err` or throws; a handler that catches an `Err` and returns `Ok` has committed.

## Database

- **Ids are `z.guid()`**, branded: `export const TodoId = z.guid().brand<"TodoId">()`, `TodoId.parse(row.id)`. `z.uuid()` rejects the non-RFC-4122 GUIDs the seed and fixtures use.
- **slonik placeholders are `$slonik_N`** in logs and errors; a raw `$1` in a template is a literal.
- **Nested `withTransaction` is a savepoint**, tracked by the `AsyncLocalStorage` scope; `hasOpenTransaction()` tells the unit of work whether to nest.
- **A row failing its zod schema throws `DatabaseError`** from slonik's result-parser interceptor — a defect, not an `Err`.
- **Timestamps arrive as `Date`, `int8` as `number`** (type parsers in `createDatabase`); write dates back with `sql.timestamp(date)`.
- **The test database name must contain `test`**; `createTestDatabase` refuses anything else so `truncate` cannot hit a dev database.

## Lint and types

- **`oxlint-tsgolint` builds each file's program from its own import graph.** A `declare module` augmentation in a file the linted file does not import is invisible; types depending on it collapse to `never`/`error` and `no-unsafe-*` fires while `tsc -b` is clean. The `AuthzConfig` augmentation lives in `platform/auth/authz.ts`, which re-exports the policy vocabulary; policies import `Check`, `CheckFor`, `ResourceCheck`, … from `@/platform/auth/authz.js`. A side-effect import (`import "…/authz.js"`) does **not** carry the augmentation.
- **`oxlint --fix` rewrites `interface X extends Y {}` into `type X = Y`**, which breaks declaration-merged tokens and `declare module` augmentations. The token files, `modules/*/policies/*.ts`, `platform/auth/authz.ts` and the authz tests are exempt from `consistent-type-definitions`, `no-empty-interface`, `no-empty-object-type` and `no-unsafe-declaration-merging` in `.oxlintrc.json`. Add a new token file to the override **before** running `pnpm lint:fix`.
- **`no-redeclare` is off** because it reports declaration merging; TS2451 owns real redeclarations.
- **Contracts must be built before web type-checks** (`pnpm -F @org/contracts build`; web's `pretypecheck`/`predev`/`prebuild` do it). Web resolves `@org/contracts` through tsconfig `paths` into `packages/contracts/build/{esm,dts}` because Turbopack does not rewrite NodeNext `.js` specifiers, and a Turbopack `paths` entry must map to **exactly one** target.
- **Generated OpenAPI types are `src/generated/api.ts`, not `.d.ts`** — `tsc -b` does not emit a `.d.ts` source into `build/dts`. Regenerate with `pnpm contracts:generate`; import via `@org/contracts/generated/api`.
- **Web wire types are `Schemas = components["schemas"]`** (`services/api/types.ts`), not the zod-inferred contract types: the wire carries plain string ids, the contracts branded ones.

## Web

- **ViewModels are hooks**; a View test stubs the ViewModel module with `vi.mock("./x.view-model", …)` and a `vi.hoisted` holder for the stub. A ViewModel test uses `renderViewModel` (`test/query-harness.tsx`) + MSW `typedHandler`.
- **sonner renders a toast's text twice** (visible + live region); assert with `findAllByText`, not `findByText`.
- **MSW is installed for the whole suite** and node's fetch needs an absolute URL — `configureApiTransport({ baseUrl: TEST_API_BASE })` in `test/setup.ts`.
