// Where the API lives and what rides on every request. A mutable record rather
// than a constant so one client factory serves the browser (`/api`, cookie jar
// attaches the session) and a test (an absolute URL MSW intercepts).

export type ApiTransport = {
  readonly baseUrl: string;
  readonly headers: Readonly<Record<string, string>>;
};

export const BROWSER_TRANSPORT: ApiTransport = { baseUrl: "/api", headers: {} };

let current: ApiTransport = BROWSER_TRANSPORT;

export const getApiTransport = (): ApiTransport => current;

export const configureApiTransport = (transport: ApiTransport): void => {
  current = transport;
};
