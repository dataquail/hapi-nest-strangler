# `@org/web`

The Next.js (App Router) renderer. It renders the screens and proxies `/api/*` to the Nest BFF on `:3001`; it does not terminate auth ([ADR-0018](../../docs/adr/0018-frontend-nextjs-renderer-and-proxy.md)).

## Before anything else

```bash
pnpm -F @org/contracts build   # web resolves @org/contracts through tsconfig paths into the built package
pnpm -F @org/web dev           # predev builds contracts, then next dev on :3000
pnpm -F @org/web typecheck     # pretypecheck builds contracts
pnpm -F @org/web test
```

After changing a route in `@org/contracts`, run `pnpm contracts:generate` at the root to regenerate `openapi.json` and `src/generated/api.ts`, then rebuild contracts. The generated `paths` and `components` are what the `openapi-fetch` client and the wire types (`services/api/types.ts`) are typed by.

## Shape

MVVM over TanStack Query v5 ([ADR-0026](../../docs/adr/0026-tanstack-query-and-frontend-mvvm.md)). The arrow points one way — View → ViewModel → Model — and `architecture.yaml` beside this file enforces it.

| Folder      | Tier                                                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`      | Next routes: framework surface. Prefetches into a per-request `QueryClient` and hydrates through `QueryHydrationBoundary`.                                                                                                                                                                         |
| `features/` | `*.view.tsx` (naked React over its ViewModel hook) + `*.view-model.ts` (a hook holding all behaviour) + tests.                                                                                                                                                                                     |
| `services/` | The Model: `api/` (client, `unwrap`, `queryKeys`, wire types), `data-access/` (`queryOptions` factories, mutation functions, server prefetches), `query/` (`useApiMutation`, the QueryClient plumbing), the notification and navigation stores and their bridges, `form-validation.ts`, `format/`. |
| `test/`     | Harnesses — see [test/README.md](test/README.md).                                                                                                                                                                                                                                                  |

The rules a contributor needs are in `.claude/rules/frontend.md` at the repo root.
