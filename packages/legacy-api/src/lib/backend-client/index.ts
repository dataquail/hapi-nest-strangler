import config = require("../../../config");
import { type BackendClient, createBackendClient } from "./create-backend-client";

// The HS256 token the Nest server's inter-service guard verifies: short lived,
// minted per call from the secret both servers hold. jose ships ESM only, so
// it is reached through a dynamic import.
const mintInterServiceToken = async (): Promise<string> => {
  const { SignJWT } = await import("jose");
  const secret: string = config("/auth/interServiceJWTSecret");
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("legacy-api")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(secret));
};

const backendClient = (): BackendClient =>
  createBackendClient({ baseUrl: config("/backend/url"), authenticate: mintInterServiceToken });

backendClient["@singleton"] = true;

export = backendClient;
