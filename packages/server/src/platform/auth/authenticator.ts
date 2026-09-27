import type { CurrentUser } from "@org/contracts/Policy";

/**
 * Resolves a presented credential to the caller. The guard names this port
 * rather than the auth module directly, because every endpoint names the
 * guard at decoration time and the auth module's own endpoints are among them.
 */
export abstract class Authenticator {
  public abstract fromBearer(token: string): Promise<CurrentUser>;
  public abstract fromSessionCookie(cookieHeader: string | undefined): Promise<CurrentUser>;
}
