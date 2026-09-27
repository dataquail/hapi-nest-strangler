# ADR-0014: Frontend layering — data-access ports, ViewModels, and Presenters

- Status: Superseded by [ADR-0026](0026-tanstack-query-and-frontend-mvvm.md)
- Date: 2026-04-28
- Superseded: 2026-08-21
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033); kept as a historical record

> **Superseded.** The three-tier scheme below existed because TanStack Query and
> TanStack Form are React-coupled and needed a tier that could hold them. The
> Effect edition replaced both with Effect Atom and collapsed to Model → ViewModel
> → View (its ADR-0026). This edition keeps TanStack Query and still has no
> presenter tier: the ViewModel _is_ a hook, and the View is tested against a
> stub of it. See ADR-0026. This record is kept for the reasoning that produced
> the tiering, which ADR-0026 argues against explicitly.

## Context and Problem Statement

The frontend has the same coupling risk as the server: business logic embedded in framework-aware code is hard to test, hard to evolve, and hard to reason about in isolation. On the server we addressed it via hexagonal layering with strict isolation (ADR-0001 through ADR-0008). The frontend equivalent is harder because the "framework" is React, and parts of the React ecosystem — TanStack Query, TanStack Form, react-hook-form, drag-and-drop libraries, animation libraries — are intrinsically React-coupled. They expose hooks, not framework-agnostic Observables. Forcing a framework-agnostic discipline on top of them is either impossible or grossly unergonomic.

A naive "all logic in components" approach trades testability for short-term velocity: components import `useQuery` and `useForm` directly; the next person reading the component cannot tell what's view, what's data, what's orchestration. A strict-MVVM approach (everything is a framework-agnostic ViewModel) gets the testability back but leaves no place for React-coupled library orchestration.

The forces:

- Components should not encode business logic, library choice, or async control flow. Their job is to render state and dispatch intents.
- Framework-agnostic orchestration is testable without a renderer; that property is worth preserving where it's achievable.
- React-coupled libraries are sometimes the right tool. The architecture must accommodate them without forcing a framework-agnostic adapter that defeats the point.
- Agents and contributors need a mechanical rule for "where does this code go?" — fuzzy heuristics produce drift.

## Decision (historical)

Three layers, with the view layer tiered into three forms classified by the _shape of their dependencies_, not their size.

### Data-access layer (ports)

`packages/web/services/data-access/` is the hexagonal port for everything the application reads or writes. Each query or mutation publishes a hook shape for components and presenters and a framework-agnostic shape for ViewModels, all backed by the same TanStack cache. The TanStack library itself is not visible above this layer.

### View layer — three tiers

**Tier 1 — naked component (`*.view.tsx`)**. JSX plus 1–3 hook calls from `services/data-access/` and any pure derivation.

**Tier 2 — Presenter (`*.presenter.ts` or `*.presenter.tsx`)**. A React-coupled custom hook that orchestrates intrinsically-React libraries (TanStack Form, react-hook-form) with data-access calls. Tested with `renderHook`.

**Tier 3 — ViewModel (`*.view-model.ts`)**. Framework-agnostic orchestration over the data-access layer's non-React shape, bridged into React by a generic adapter. Cannot import React or any React-coupled library.

### The graduation rule

- React-library state (form fields, drag handlers, animation refs) plus possibly data-access → **Presenter**.
- Framework-agnostic orchestration (queries, mutations, derivations) with no React-library state → **ViewModel**.
- Just data plus JSX → **naked component**.

### Enforcement

Layering was enforced by import rules (TanStack importable only from `services/data-access/**`; ViewModels may not import React; Presenters may import anything) and by a deny-by-default file taxonomy over `features/**` (`*.view.tsx`, `*.presenter.{ts,tsx}`, `*.view-model.ts`, tests) with test parity on Presenters and ViewModels.

## Why it was superseded

The presenter tier existed to hold hooks, and once the ViewModel is itself a hook (ADR-0026) there is nothing left for a second hook tier to hold. Two tiers of hook with a graduation rule between them is a classification a reader has to make on every file; one tier with a mechanical arrow (View → ViewModel → Model) is not. The framework-agnostic ViewModel over TanStack's `QueryObserver` was a hand-written adapter over a React-first library, and the testability it bought is recovered by `renderHook` under a `QueryClientProvider` — which is a plain function call with a provider around it, not a renderer in any meaningful sense.

## Related

- ADR-0026 — the two-tier layering that supersedes this.
- ADR-0015 — the component library, unchanged by the supersession.
- ADR-0009 — the testing principles.
