import type * as Event from "./event.js";

/**
 * The optional seam that decides what "after commit" waits for. The bus hands a
 * dispatch's events to the sink before any immediate handler runs; whoever owns
 * a commit (the unit of work) drains them afterwards. With no sink attached the
 * bus runs its after-commit handlers at the end of each dispatch.
 */
export type DeferralSink = {
  readonly defer: (events: ReadonlyArray<Event.Base>) => void;
};

/** Runs one after-commit reaction inside whatever boundary the host wants — a fresh unit of work. */
export type ReactionBoundary = <A>(reaction: () => Promise<A>) => Promise<A>;
