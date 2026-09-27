import { SignJWT } from "jose";

export const TEST_SERVICE_SECRET = "test-inter-service-secret-0123456789abcdef";

type Options = {
  readonly secret?: string;
  readonly expiresIn?: string;
};

/** The HS256 token the legacy API would present; signed with the test secret unless a test says otherwise. */
export const mintServiceToken = (options: Options = {}): Promise<string> =>
  new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("legacy-api")
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? "5m")
    .sign(new TextEncoder().encode(options.secret ?? TEST_SERVICE_SECRET));
