// The four host types this library is written against but does not own: who is
// asking, what a check or resolver may fail with, how a resolver reports
// absence, and the verbs a policy may be keyed on. A host declares them once by
// augmenting `AuthzConfig`:
//
//   declare module "@org/authz/config" {
//     interface AuthzConfig {
//       caller: CurrentUser;
//       checkFailure: PersistenceUnavailable;
//       resourceMissing: NotFound;
//       action: AppAction;
//     }
//   }
//
// Must stay an `interface` (declaration merging does not work on `type`).
export interface AuthzConfig {}

/** The identity a check interrogates. `never` when unconfigured, so a check reaching for a field fails at the host's first check. */
export type Caller = AuthzConfig extends { caller: infer C } ? C : never;

/** What a check or a resolver is allowed to fail with. One type covers both because both read the same store. */
export type CheckFailure = AuthzConfig extends { checkFailure: infer E } ? E : never;

/** How a resolver reports "no such resource". The default for any resource that does not opt out with `notFound: never`. */
export type ResourceMissing = AuthzConfig extends { resourceMissing: infer N } ? N : never;

/** The closed set of verbs a policy may be keyed on. Unconfigured it is `string`, which imposes nothing. */
export type Action = AuthzConfig extends { action: infer A } ? A : string;
