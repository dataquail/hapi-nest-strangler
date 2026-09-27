# ADR-0026: TanStack Query as the frontend state substrate, and MVVM as the layering

- Status: Accepted
- Date: 2026-08-21
- Supersedes: ADR-0014
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033); slug was `effect-atom-and-frontend-mvvm`

## Context and Problem Statement

ADR-0014 tiered the view layer into three forms — naked component, presenter, ViewModel — and graduated code between them. The graduation rule existed for one reason: TanStack Query and TanStack Form are React-coupled, so any orchestration that touched them had to live somewhere a renderer could run, and that somewhere could not be tested without React.

The Effect edition answered by replacing TanStack with Effect Atom, whose graph runs under a bare registry, and collapsing to Model → ViewModel → View. This edition has no Effect and keeps TanStack Query. The question is whether MVVM survives when the ViewModel is necessarily a hook.

It does, because the property MVVM is after is not "no React in the ViewModel" but **one direction of dependency and one place for behaviour**. A ViewModel that is a hook over `useQuery`/`useMutation`/`useState` still holds all of a feature's behaviour, is still tested without rendering a View, and still leaves the View with nothing to do but render and dispatch.

Three costs of the old tiering are addressed the same way as before.

**Testing.** A ViewModel is tested with `renderHook` under a fresh `QueryClient` and MSW — a function call with a provider around it, not a component tree. A View is tested by stubbing its ViewModel module with `vi.mock` and asserting on what it renders and what it calls back.

**Two cache models.** Server data lives in the TanStack cache; form and page state live in React state inside the ViewModel; nothing lives in a component. Invalidation is one typed key factory (`services/api/query-keys.ts`) both sides declare against, so a typo is a missing property rather than a stale screen.

**Hydration lies about types.** TanStack's `dehydrate → JSON → hydrate` re-runs no decode, so a date field arrives as whatever the wire carried. This edition makes that honest rather than working around it: dates are ISO strings on the wire (ADR-0010) and the frontend's types are the generated `components` schemas, so the type and the value agree on both sides of the boundary.

## Decision

**TanStack Query v5 over an `openapi-fetch` client is the frontend state substrate, and the frontend is layered Model → ViewModel → View with the dependency arrow enforced in that direction only.**

### The Model — `packages/web/services/`

- `services/api/client.shared.ts` — `openapi-fetch` over the generated `paths` (`@org/contracts/generated/api`), built from a swappable transport (`transport.shared.ts`: `/api` in the browser, an absolute URL under MSW). `client.server.ts` builds a per-request client with the inbound cookie for server components.
- `services/api/api-error.ts` — `unwrap(response)`: the data, or a thrown `ApiError` carrying the wire's `_tag`, status and body. TanStack needs a throw to settle an error; the ViewModels switch on the tag.
- `services/api/query-keys.ts` — the invalidation vocabulary: a root per feature (`queryKeys.todos.all`) and a keyed entry under it (`queryKeys.todos.list(orgId)`).
- `services/api/types.ts` — `Schemas = components["schemas"]`, the wire types a ViewModel names. A contract's zod-inferred type carries branded ids; on the wire an id is a plain string, and the branded type narrows to it but not the other way round.
- `services/data-access/<feature>.queries.ts` — `queryOptions(...)` factories keyed by the vocabulary, and plain `async` mutation functions, all over `unwrap`. `<feature>.server.ts` is the `import "server-only"` prefetch beside it, built over the server client.
- `services/query/` — `use-api-mutation.ts` (`useApiMutation`: the mutation function, the roots it invalidates, and the notification policy by tag), the per-request server `QueryClient`, the prefetch helper and `QueryHydrationBoundary` (ADR-0018), and the browser `QueryProvider`.
- `services/notifications.shared.ts` and `services/navigation.shared.ts` — two seams that would have been injected services are **state**: a tiny external store (`store.shared.ts`, read with `useSyncExternalStore`) a ViewModel writes to and a bridge at the edge of the app turns into sonner or `router.push`. A test reads the store back.
- `services/form-validation.ts` — `validateWithSchema(ContractSchema)`: zod issues reduced to a per-field error map.

### The ViewModel — `features/**/*.view-model.ts`

All of a feature's behaviour, as one hook (`useAddTodoViewModel(orgId)`) returning a plain object of view state and actions, plus the pure derivations beside it (`computePaginationView`, `computeBillingPanelView`) exported for their own tests:

```ts
export const useAddTodoViewModel = (orgId: OrganizationId): AddTodoViewModel => {
  const [fields, setFields] = React.useState<AddTodoFields>(EMPTY_FIELDS);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const errors = React.useMemo(() => validate(fields), [fields]);
  const mutation = useApiMutation({
    mutationFn: (payload: TodosContract.CreateTodoPayload) => createTodo({ orgId, payload }),
    invalidates: [queryKeys.todos.all],
    notify: { success: () => "Todo created!" },
    onSuccess: () => { setFields(EMPTY_FIELDS); setSubmitAttempted(false); },
  });
  ...
};
```

It may import React and TanStack Query; it may not import a View or `@org/components`. A ViewModel test renders the hook under `renderViewModel` (`test/query-harness.tsx`), drives it with `act`, waits with `settle`, and asserts on the returned value and on the two stores.

### The View — `features/**/*.view.tsx`

Naked React. It calls its own ViewModel hook and nothing else with state — no `useState`, no `useEffect`, no `useQuery`; `useId` and `useCallback` are the two hooks that carry no state. A prop that would have been copied into state (`initialCode` on the device page) becomes the ViewModel hook's argument, which seeds `useState` once.

A View is tested by injecting the ViewModel's output: `vi.mock("./x.view-model")` replaces the hook with a stub the test builds, which states the left-hand side, and the stub's `vi.fn()` actions check the right-hand side. No server, no fetch, and no ViewModel derivation in between.

**There is no presenter tier.** It existed to hold a React-coupled library away from a framework-agnostic ViewModel; with the ViewModel a hook, there is one tier of hook and nothing to graduate between.

### Forms

Fields as `useState` in the ViewModel, a derived errors value over the contract schema through `validateWithSchema`, and a submit that sets `submitAttempted` before it guards. Validation surfaces only after the first attempt. The notification lives inside `useApiMutation`'s success/error callbacks, so an invalid submit that never calls the API never announces anything.

### The dependency arrow

| From                          | May depend on                                                        | May not                     |
| ----------------------------- | -------------------------------------------------------------------- | --------------------------- |
| `app/**` (framework surface)  | Model, features                                                      | —                           |
| `features/**/*.view.tsx`      | its own ViewModel, `@org/components`, `@org/contracts`, react        | `services/**`, TanStack     |
| `features/**/*.view-model.ts` | `services/**`, sibling ViewModels, `@org/contracts`, react, TanStack | any View, `@org/components` |
| `services/**`                 | contracts, TanStack, `openapi-fetch`, react, next, `server-only`     | `features/**`               |

Enforced by `packages/web/architecture.yaml`: the View node's allowlist and hook allowlist, the ViewModel node's allowlist, the Model node's allowlist, and the deny-by-default file taxonomy over `features/**` (a feature file is a View, a ViewModel, or a test). Every `*.view-model.ts` owes a sibling `*.view-model.test.ts`.

### Server-side

No `QueryClient` is module-global. `getQueryClient` is `React.cache`d per request, the route's prefetch fills it, and `QueryHydrationBoundary` dehydrates it into the client (ADR-0018). A failed prefetch yields no entry rather than throwing — which is also how "this org has no subscription yet" works: the Model folds the 404 into `null` in the query function, so both the prefetch and the client see the same value.

## Consequences

- `@tanstack/react-query`, `openapi-fetch` and `msw` are the web's dependencies of note; `@effect/atom-react`, `effect`, `mutative` and `scheduler` are gone.
- Wire types come from the generated OpenAPI schemas rather than the zod contracts; fixtures still parse through the contracts, so the drift gate stands.
- The contracts package must be built before web type-checks or runs (`pretypecheck`/`predev`/`prebuild`), because Turbopack resolves through tsconfig `paths` and does not rewrite NodeNext `.js` specifiers (ADR-0018).
- A ViewModel test is a hook test. It is still no renderer in the sense that matters: nothing is painted, and the assertions are about values.

## Supersedes / differs from the Effect edition

`Atom.make` / `Atom.family` / `Atom.fnSync` → a hook with `useState`, `useMemo` and `useCallback`; `ApiAtoms.query` / `ApiAtoms.mutation` → `queryOptions` factories and `useApiMutation`; `reactivityKeys` → `queryKeys`; `Atom.keepAlive` stores → `makeStore` + `useSyncExternalStore`; `renderView(ui, { initialValues })` → `vi.mock` of the ViewModel module. The memo-map hazard has no counterpart. The arrow, the file taxonomy and the no-state-in-Views rule are unchanged.

## Alternatives considered

**Framework-agnostic ViewModels over TanStack's `QueryObserver`.** ADR-0014's Observable shape. Rejected: a hand-written adapter over a React-first library, bought with a tier of boilerplate, to avoid a `renderHook` that costs nothing.

**Keep a presenter tier for forms.** Rejected: with TanStack Form not adopted, the only thing left to hold is `useState`, which is exactly the state MVVM wants in the ViewModel.

**Zustand or Jotai for the non-server state.** Rejected: two `useState` calls per form do not justify a store library, and the two cross-cutting seams are a twenty-line store.

## Related

- ADR-0014 — the three-tier layering this supersedes.
- ADR-0015 — the component library the View tier renders through.
- ADR-0018 — the Next renderer and `/api` proxy; its prefetch section is stated over the per-request `QueryClient`.
- ADR-0019 — the integration-test seam, mounting a `QueryClientProvider`.
- ADR-0025 — the lint substrate the rules and their probes run on.
