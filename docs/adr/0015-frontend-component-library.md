# ADR-0015: Frontend component library — primitives, patterns, and the encapsulation of third-party UI

- Status: Accepted
- Amended: 2026-08-21 — the prop-API contract (no `className`, no `style`, no DOM
  spread), the layout/typography/surface primitive set, and the widened
  `forbid-elements` ban. See "The prop API is the contract" below.
- Date: 2026-04-29
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

ADR-0026 layers the frontend into Model, ViewModel and View, and enforces the arrow with the manifest. It says nothing about the visual surface — what JSX a View is allowed to produce.

Without a rule there, two failure modes appear over time. First, every feature reaches for the third-party UI library directly: `@radix-ui/*` for primitives, `lucide-react` for icons, `recharts` for charts, `sonner` for toasts. The library's prop surface — including props the design system never wanted to expose — leaks into feature code. Swapping or upgrading the library means touching every feature. Second, slightly-richer compositions that ought to be reused (a filter pill, a confirm dialog, a paginated table) get re-implemented in each feature because there is no formalized place to put them and no vocabulary for promoting them.

The forces:

- The application needs a stable visual vocabulary. Buttons, inputs, badges, and icons should look and behave the same everywhere, and changing how they look should be a one-file edit.
- The third-party UI library is an implementation detail. Its identity (today shadcn/Radix + lucide) and its prop surface are not contracts the application should depend on.
- Composite UI (filter bars, data tables, pagination, empty states) wants a home. Without one it gets re-implemented; with too many tiers it becomes a bikeshed.
- The rule must be machine-enforceable. "Review will catch it" decays; mechanical rules don't.
- Some compositional UI carries state (sort, pagination, filter logic). ADR-0026 already provides ViewModels for that — the component-library layer should plug into them, not duplicate them.

## Decision

Two folders in `packages/components/` (a sibling workspace package consumed as `@org/components`), with the third-party encapsulation enforced at the folder boundary by the manifest. Storybook is hosted in the same package so the catalog has a stable home decoupled from the renderer's bundler conventions. The package is framework-free apart from React: it names no state library and no Effect module.

### `components/primitives/` — atoms

The smallest visual units, each owning a single concern: `Button`, `Input`, `Label`, `Badge`, `Card`, `Dialog`, `Select`, etc. Primitives are the **only** place in the codebase that may import third-party visual libraries (`@radix-ui/*`, `lucide-react`, `recharts`, `sonner`). They define the application's prop contract — variants, sizes, tones — and forward the constrained surface to the underlying library.

Class-name utilities (`clsx`, `tailwind-merge`, `class-variance-authority`) are not visual libraries and are not subject to the encapsulation rule; `lib/utils/cn.ts` composes the first two in a plain function.

### `components/patterns/` — molecules and organisms

Compositions built from primitives (and other patterns) doing one focused job. The atomic-design vocabulary distinguishes molecules (small, single-job: `FormField`, `EmptyState`, `ListRow`) from organisms (larger, often stateful: `Pagination`, `AppShell`, `PageShell`, `CardSection`). The vocabulary is useful for design conversation; the codebase does not need three folders to express it. Two tiers in folders, three in vocabulary.

A pattern that carries state plugs into ADR-0026's layering: an organism with non-trivial logic ships as a folder containing the component, its `*.view-model.ts`, and tests, co-located. The organism remains domain-agnostic; the consuming feature passes data and intents in.

Patterns may import primitives and other patterns. Patterns may not import third-party visual libraries directly; they go through primitives. Patterns may not import `features/`.

### `features/` consumes both

Feature Views import primitives and patterns. They may not import third-party visual libraries. The dependency direction is `features → patterns → primitives → third-party`, never reversed, never skipping a step on the way out.

### Icons — a constrained-prop wrapper, not a re-export

Icons sit inside primitives (`components/primitives/icon/`). The wrapper exposes a project-owned `IconProps` (`size`, `tone`, `aria-label`, `aria-hidden`, `data-testid`) and forwards to lucide internally. Adding a new icon is one line via a `createIcon` factory; tree-shaking is preserved because each icon is its own export. `aria-hidden` defaults to `true`, so decorative use is the path of least resistance and labelled use is opt-in.

### Promotion path

A component starts where it is used. When a second feature wants the same shape, lift it to `components/patterns/`. The bar is "would I copy this," not "could this in principle be reused." Lifting is a mechanical move-and-rename; reverting it is the same in the other direction.

### Discoverability

Storybook is the canonical index. Every primitive and pattern ships a sibling `*.stories.tsx` showing default rendering, variant matrix, light/dark theming, and interactive states. Run `pnpm -F @org/components storybook` to open it locally. The manifest's parity rule (ADR-0008) fails CI if a primitive or pattern lands without a sibling story.

### Enforcement

- `packages/components/architecture.yaml` — `primitives/` is the only node whose `external` names `@radix-ui/*`, `lucide-react`, `recharts` and `sonner`; `patterns/` may reach only `primitives/`, `patterns/` and `lib/`; nothing under `components/` may reach `packages/web`. `packages/web/architecture.yaml` grants Views `~/components/**` and no visual library.
- oxlint (`pnpm lint`): `react/forbid-elements` scoped to `features/**/*.tsx`, `app/**/*.tsx` and `patterns/**/*.tsx` bans **every** raw HTML element that has a primitive equivalent — `<div>`, `<span>`, `<p>`, `<h1>`–`<h4>`, `<ul>`, `<ol>`, `<li>`, `<nav>`, `<a>`, `<button>`, `<input>`, `<label>`, `<select>`, `<form>`, `<section>`, `<header>`, `<footer>`, `<main>`, `<table>`, `<img>`. `local/no-inline-styling` bans `className` and `style` as JSX attributes on the same paths. Test and story files exempted.
- Parity: every `components/primitives/**/*.tsx` and `components/patterns/**/*.tsx` requires a sibling `*.stories.tsx` (`component-story-parity`).
- CI gate (`pnpm check:all`): `pnpm -F @org/components build-storybook` runs after the test suite. Broken stories fail the build before merge.

### The prop API is the contract

Amended 2026-08-21. The original ADR left `<div>`, `<span>`, headings and text free on the reasoning that "layout containers and text legitimately need them", and left `className` alone entirely. Both concessions turned out to be the same hole.

A consumer-supplied class is a design decision made **outside** the design system. It is invisible to Storybook, invisible to the a11y addon, invisible to review, and impossible to change centrally afterwards. It also makes the intrinsic-element ban vacuous: banning `<button>` while allowing `<div className="flex items-center gap-2">` moves the design decision one element sideways rather than removing it.

So:

- **Every primitive exposes explicit props with closed unions, and spreads nothing onto the DOM.** `<Card className="shadow-md">` is a _type error_ — TypeScript rejects it at the call site with no rule involved, and the lint rule becomes the backstop for the case a primitive regresses to a DOM spread.
- **The class strings stay literal in the primitive.** Tailwind's scanner needs them written out, and a `Record<Variant, string>` is what keeps a screen from inventing spacing the design system has not agreed to.
- **Layout, typography and surfaces are primitives too.** `Stack`, `Grid`, `Container`, `Surface`, `Text`, `Heading`, `List`, `Nav`, `Link`, `Spinner`, `Reveal`.
- **`app/**` is exempt.** It is framework surface, not a screen: page shells and route-level skeletons keep their intrinsics.

**When a prop API is too narrow to express a real design, the answer is always "widen the primitive" — never "reopen `className`".** The story file is where the new variant is proven.

## Consequences

- **The third-party UI library is swappable.** Replacing shadcn/Radix or lucide is a `components/primitives/` edit. No feature code changes.
- **Compositions have a home.** "Where does this filter pill go?" has one answer.
- **The prop API is the whole contract, and the type system enforces it.** A screen cannot express a visual decision the design system has not agreed to, in either direction.
- **Controlled components are strictly controlled.** `Input`, `Checkbox` and `Select` require their value and change handler. `defaultValue` / `defaultChecked` do not exist, because uncontrolled state in a View is state outside the ViewModel (ADR-0026).
- **Adding an icon is friction by design.** A developer who needs a new icon must add a one-line wrapper. That friction is the moment the design system gets to confirm the icon is wanted.

## Supersedes / differs from the Effect edition

The package no longer names `effect` at all: `Schema.Literals` in the theme provider became a `const` tuple and a type guard, `String.isEmpty` became `length === 0`, `flow(clsx, twMerge)` became a plain function. Everything else — the two trees, the prop contract, the bans, the story parity — is unchanged.

## Alternatives considered

- **Three folders (atoms / molecules / organisms).** Rejected: the molecule-vs-organism boundary is famously fuzzy and produces bikeshedding. Two folders capture the only boundary that matters mechanically.
- **Per-icon re-exports without wrappers.** Rejected: leaks lucide's prop surface.
- **Generic `<Icon name="trash" />` component.** Rejected: loses tree-shaking and forces a name registry.
- **Skip `react/forbid-elements` and rely on the import rule plus review.** Rejected: the import rule does not catch a raw `<button onClick={...}>`, and that gap was already exploited once.
- **Markdown README as the canonical index.** Initially adopted; replaced by Storybook once the variant matrix stopped fitting a table.

## Related

- ADR-0008 (architecture enforcement) — the manifest that carries the folder boundary and the story parity.
- ADR-0026 (TanStack Query and MVVM) — the tiering that organisms-with-state plug into.
