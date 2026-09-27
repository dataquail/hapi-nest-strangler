# Rule: frontend (web + component library)

**Scope:** `packages/web/` and `packages/components/` — read before touching frontend code.
**Backing ADRs:** 0026 (TanStack Query + MVVM), 0015 (component library), 0018 (Next renderer + proxy), 0019 (integration seam).

The frontend is a Next.js (App Router) renderer that proxies `/api/*` to the legacy hapi API (ADR-0034). That server stays the BFF — Next renders + proxies but does NOT terminate auth. See ADR-0018.

**State is TanStack Query v5** over an `openapi-fetch` client typed by the generated OpenAPI `paths`, plus two tiny external stores (notifications, navigation). There is no Effect, no atom graph, no Redux. **`pnpm -F @org/contracts build` must run before web type-checks or runs** (`pretypecheck`/`predev`/`prebuild` do it): web resolves `@org/contracts` through tsconfig `paths` into the built package.

## MVVM: Model → ViewModel → View

The arrow points one way and is enforced. Nothing else in this file matters as much.

| Tier          | Lives in                                  | May depend on                                                                   | Tested by                                            |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Model**     | `services/`                               | `@org/contracts`, TanStack, `openapi-fetch`, react, next                        | plain functions + MSW                                |
| **ViewModel** | `features/**/*.view-model.ts`             | the Model, react, `@tanstack/react-query`, sibling ViewModels                   | `renderViewModel` (`renderHook` + QueryClient) + MSW |
| **View**      | `features/**/*.view.tsx`                  | its own ViewModel, `@org/components`, `@org/contracts`, `services/api/types.ts` | RTL with the ViewModel module stubbed via `vi.mock`  |
| framework     | `app/`, `services/**/*.{client,server}.*` | anything                                                                        | integration tier                                     |

- A **View may not import `services/`** (the one exception is the wire types file). Everything it renders or dispatches arrives from the object its ViewModel hook returns.
- A **ViewModel may not import a View or `@org/components`.**
- The **Model may not import `features/`.**
- A **View may only call its own `use<Feature>ViewModel` hook** plus `useId`/`useCallback` (the `view-file` members rule). No `useState`, no `useEffect`, no `useQuery` — that state belongs in the ViewModel. A prop you would have copied into state becomes the ViewModel hook's argument (`useApproveDeviceViewModel(initialCode)`).

**File taxonomy** (`packages/web/architecture.yaml`, the `children` of `features/`, deny-by-default): a file in `features/**` is a `*.view.tsx`, a `*.view-model.ts`, or a `*.test.{ts,tsx}` (route-level integration tests under `__tests__/`). Every `*.view-model.ts` owes a sibling `*.view-model.test.ts`; views carry no parity obligation. **There is no presenter tier.**

## Layout (`packages/web/`, no `src/` wrapper)

- `app/` — Next file-based routes. `(authed)/` is the protected route group (server-side guard in `(authed)/layout.tsx` calls `/auth/me`, `redirect()`s on 401). `app/providers.tsx` (`Providers`) is `ThemeProvider → QueryProvider`. `app/**` is framework surface: it keeps its intrinsics and composes the Model directly (prefetch + hydration boundary).
- `features/` — one folder per feature, `*.view.tsx` + `*.view-model.ts` + tests.
- `services/` — the Model.
  - `services/api/` — `client.shared.ts` (`getApiClient()`, `openapi-fetch` over `paths`), `client.server.ts` (per-request client with the inbound cookie), `transport.shared.ts`, `api-error.ts` (`unwrap` → data or thrown `ApiError` with the wire `_tag`), `query-keys.ts` (the invalidation vocabulary), `types.ts` (`Schemas = components["schemas"]`, the wire types ViewModels name).
  - `services/data-access/<feature>.queries.ts` — `queryOptions(...)` factories keyed by `queryKeys` + plain async mutation functions over `unwrap`; `<feature>.server.ts` — the `import "server-only"` prefetch beside it.
  - `services/query/` — `use-api-mutation.ts` (`useApiMutation({ mutationFn, invalidates, notify, onSuccess })`), `query-client.shared.ts` (`makeQueryClient`), `get-query-client.server.ts` (`React.cache`d per request), `prefetch.server.ts`, `hydration-boundary.tsx` (`QueryHydrationBoundary`), `query-client.client.tsx` (`QueryProvider`).
  - `store.shared.ts` / `use-store.shared.ts` (`makeStore` + `useSyncExternalStore`), `notifications.shared.ts`, `navigation.shared.ts`, the two `*-bridge.client.tsx`, `form-validation.ts` (`validateWithSchema`), `format/`.
  - Environment suffixes: `*.shared.ts` (agnostic), `*.server.ts` (`import "server-only"`), `*.client.tsx` (`"use client"`).
- `instrumentation.ts` — Node OTEL via `@vercel/otel`, exporting to the same collector as the server. There is no browser-side tracer.

## Reading and writing data

```ts
// Model — services/data-access/todos.queries.ts
export const todosQuery = (orgId: OrganizationId) =>
  queryOptions({
    queryKey: queryKeys.todos.list(orgId),
    queryFn: async () => unwrap(await getApiClient().GET("/orgs/{orgId}/todos", { params: { path: { orgId } } })),
  });
export const createTodo = async ({ orgId, payload }: { orgId: OrganizationId; payload: TodosContract.CreateTodoPayload }) =>
  unwrap(await getApiClient().POST("/orgs/{orgId}/todos", { params: { path: { orgId } }, body: payload }));

// ViewModel — features/index/add-todo.view-model.ts
export const useAddTodoViewModel = (orgId: OrganizationId): AddTodoViewModel => {
  const [fields, setFields] = React.useState(EMPTY_FIELDS);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const errors = React.useMemo(() => validateWithSchema(TodosContract.CreateTodoPayload)(fields), [fields]);
  const mutation = useApiMutation({
    mutationFn: (payload: TodosContract.CreateTodoPayload) => createTodo({ orgId, payload }),
    invalidates: [queryKeys.todos.all],
    notify: { success: () => "Todo created!" },
    onSuccess: () => setFields(EMPTY_FIELDS),
  });
  const submit = React.useCallback(() => {
    setSubmitAttempted(true);
    if (errors !== null) return;
    mutation.mutate(fields);
  }, [errors, fields, mutation]);
  return { fields, errors: submitAttempted ? errors : null, submit, isPending: mutation.isPending, setTitle: … };
};
```

- **Invalidation is a query-key root.** A query is keyed under its feature's root (`queryKeys.todos.list(orgId)`), a mutation invalidates the root (`queryKeys.todos.all`); a typo is a missing property, not a stale screen.
- **Hydration**: a route composes `<QueryHydrationBoundary prefetch={[prefetchTodos(orgId)]} fallback={…}>`; the View's ViewModel reads with `useSuspenseQuery(todosQuery(orgId))`. The `QueryClient` is per request (`getQueryClient`, `React.cache`) — never module-global on the server. Dates are ISO strings on the wire and stay strings in the cache; format them in the ViewModel with `services/format/date.shared.ts`.
- **Errors**: `unwrap` throws `ApiError` carrying the wire `_tag`; `useApiMutation`'s `notify.errors` maps tags to messages, `otherwise` covers the rest. A 404 that means "nothing yet" (no subscription) is folded into `null` inside the query function so the prefetch and the client agree.
- **Notifications and navigation are state**, not injected services: a ViewModel writes `pushNotification(...)` / `navigateTo(href)`, and one bridge at the edge of the app turns it into sonner or `router.push`. A test reads the store back.
- **Forms** are fields-as-`useState` in the ViewModel + a derived errors value over the contract schema (`validateWithSchema`). Validation surfaces only after the first submit attempt. Notifications live inside `useApiMutation`, so an invalid submit that never calls the API never announces anything.

## Component library (`packages/components/`, ADR-0015)

Two trees: `primitives/` (atoms) and `patterns/` (molecules + organisms). Direction: `features (web) → patterns → primitives → third-party`. Only `primitives/` may import `@radix-ui/*`, `lucide-react`, `recharts`, or `sonner`. New icons: a one-line `createIcon` wrapper in `primitives/icon/icons.ts`.

**The prop API is the contract.** In `features/**`, `patterns/**` and `app/**`:

- **No raw intrinsics.** `react/forbid-elements` bans the whole set a screen would reach for — `div`, `span`, `p`, `h1`–`h4`, `ul`/`ol`/`li`, `nav`, `a`, `button`, `input`, `label`, `select`, `form`, `section`, `header`, `footer`, `main`, `table`, `img`. Use `Stack`, `Grid`, `Container`, `Surface`, `Text`, `Heading`, `List`, `Nav`, `Link`, `Button`, `Input`, `Label`, `Select`, `Form`, …
- **No `className`, no `style`** (`local/no-inline-styling`); no primitive accepts `className`, so passing one is a type error.
- **When a primitive can't express what you need, widen the primitive and prove the variant in its story.** Never reopen `className`, never add a DOM spread.
- **Only `app/layout.tsx` is exempt** — `<html>`/`<body>` are the document root.

**Composing a page**: `PageShell` (centred, width-capped column) wraps `CardSection`s; the authed layout is an `AppShell`. `Input`, `Checkbox` and `Select` are **strictly controlled** — value and change handler required, no `defaultValue`. Every primitive and pattern needs a sibling `*.stories.tsx`. Storybook: `pnpm -F @org/components storybook`; a static build is part of `check:all`.

## Tests

| Tier            | Harness                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Model**       | call the function; MSW `typedHandler(route, resolver)` + `ok(...)` / `fail(HttpErrors.X, body)` (`test/typed-handler.ts`)                                          |
| **ViewModel**   | `renderViewModel(() => useXViewModel(...))` (`test/query-harness.tsx`) → `{ result, settle, client }`; drive with `act`                                            |
| **View**        | `vi.mock("./x.view-model", …)` returning a stub built in the test; `render(<X />)`; assert on the stub's `vi.fn()`s                                                |
| **Integration** | `renderWithHarness` (`test/integration-harness.tsx`) — ThemeProvider + QueryClientProvider + NotificationBridge + Toaster + MSW; drive through `@org/test-drivers` |
| **Acceptance**  | `packages/acceptance` (Playwright), unchanged                                                                                                                      |

- **MSW is installed globally** (`test/setup.ts`), not per file; `test/handlers/<feature>.ts` hold the default handlers over `test/fixtures/`. A View test that stubs its ViewModel needs no handler; a ViewModel test registers the handlers for every query the hook mounts, or the in-flight request fails as unhandled.
- MSW resolves the **most recently registered handler first**. To make a refetch see different data than the first load, register the second handler in its own later `server.use(...)` call.
- A ViewModel test asserts a mutation ran by `settle`-ing on `isSuccess` or on the invalidated query's new data, and reads `notificationStore` / `navigationRequestStore` for the announcement.
- The integration harness deliberately does **not** mount `NavigationBridge`: it holds the Next router. Assert on `navigationRequestStore` instead. sonner renders a toast's text twice; use `findAllByText`.
- Fixtures parse through the contracts' zod schemas, so a fixture that drifts from the contract fails at import.

## Run locally

```bash
pnpm bootstrap                    # Docker (postgres, jaeger, zitadel) + migrate + seed
pnpm --filter @org/legacy-api dev # hapi API on :9000, the BFF the browser talks to
pnpm --filter @org/server dev     # Nest server on :3001, the wallet, reached only from hapi
pnpm --filter @org/web dev        # Next.js on :3000 (builds contracts first); /api/* rewrites to :9000
```
