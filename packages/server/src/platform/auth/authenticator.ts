import type { CurrentUser } from "@org/contracts/Policy";

// The guard names this port, never the store behind it, because every private
// endpoint names the guard at decoration time.
export abstract class Authenticator {
  public abstract fromBearer(token: string): Promise<CurrentUser>;
  public abstract fromSessionCookie(cookieHeader: string | undefined): Promise<CurrentUser>;
}
