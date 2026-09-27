# `@org/web` test utilities

Helpers for testing the Model, ViewModel and View tiers without a real server. Pair with vitest + jsdom (see `vitest.config.ts`). MSW is installed for the whole suite by `setup.ts`.

## What lives here

| File                      | Purpose                                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup.ts`                | Registered as `setupFiles`: jest-dom matchers, `cleanup()`, the MSW lifecycle, `configureApiTransport({ baseUrl: TEST_API_BASE })`, and a reset of the notification and navigation stores between tests. |
| `msw-server.ts`           | The `server` (`msw/node`) and `installMswLifecycle()`; unhandled requests are errors.                                                                                                                    |
| `typed-handler.ts`        | `typedHandler(route, resolver)` — an MSW handler declared by contract route, with decoded params/query/body; reply with `ok(value)` or `fail(HttpErrors.X, body)`.                                       |
| `handlers/<feature>.ts`   | The default handlers per feature over the fixtures; `handlers/index.ts` gathers them.                                                                                                                    |
| `fixtures/<feature>.ts`   | Wire-shaped fixtures parsed through the contracts' zod schemas, so a fixture that drifts fails at import.                                                                                                |
| `query-harness.tsx`       | `makeTestQueryClient()` and `renderViewModel(hook)` — `renderHook` under a fresh `QueryClient` + Suspense; returns `{ result, client, settle }`.                                                         |
| `integration-harness.tsx` | `renderWithHarness(ui)` — ThemeProvider + QueryClientProvider + NotificationBridge + Toaster, for route-level tests under `features/**/__tests__/`.                                                      |

## When to use what

- **Model tests** (`services/**/*.test.ts`) — call the function; register `typedHandler`s with `server.use(...)`.
- **ViewModel tests** (`*.view-model.test.ts`) — `const vm = renderViewModel(() => useXViewModel(args))`; register handlers for every query the hook mounts; drive with `act(() => vm.result.current.doThing())`; `await vm.settle((v) => v.isSuccess)`; assert on the returned value and on `notificationStore` / `navigationRequestStore`. The pure derivations beside a hook (`computeXView`) are tested as plain functions.
- **View tests** (`*.view.test.tsx`) — `vi.mock("./x.view-model", …)` replacing `useXViewModel` with a stub held in a `vi.hoisted` holder; build the stub per test (`{ ...computeXView(...), action: vi.fn() }`); `render(<X />)`; assert on what is rendered and which stub actions were called. No handlers needed.
- **Integration tests** (`features/**/__tests__/*.integration.test.tsx`) — `renderWithHarness(<Route />)` and drive through `@org/test-drivers`. The navigation bridge is not mounted (it holds the Next router): assert on `navigationRequestStore`. sonner renders a toast's text twice; use `findAllByText`.

MSW resolves the most recently registered handler first. To make a refetch see different data than the first load, register the second handler in its own later `server.use(...)` call.
