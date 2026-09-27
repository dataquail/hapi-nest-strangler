import type { Request } from "@hapi/hapi";

// The bookshelf user the session strategy attached; only meaningful behind `auth: "session"`.
export const currentUser = (request: Request): any => (request.auth.credentials as any).user;
