import "@hapi/hapi";

declare module "@hapi/hapi" {
  interface UserCredentials {
    [key: string]: any;
  }
  interface AuthCredentials {
    sessionId?: string;
    authType?: "SESSION" | "TOKEN" | "MACHINE";
  }
}
