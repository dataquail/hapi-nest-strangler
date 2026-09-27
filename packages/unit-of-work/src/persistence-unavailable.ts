/**
 * Domain-language signal that the store backing a repository is momentarily
 * unable to service the request — connection lost, backend terminated,
 * transient outage. The right reaction at a transport boundary is a 503; the
 * right reaction in a use case is to propagate.
 *
 * It lives here rather than in a host's database package so a module's `domain/`
 * can name it in a repository port without importing infrastructure.
 */
export class PersistenceUnavailable {
  public readonly _tag = "PersistenceUnavailable" as const;
  public readonly message: string;
  constructor(props: { readonly message: string }) {
    this.message = props.message;
  }
}
