import { authHandlers } from "./auth";
import { billingHandlers } from "./billing";
import { deviceHandlers } from "./device";
import { orgsHandlers } from "./orgs";
import { todosHandlers } from "./todos";
import { usersHandlers } from "./users";

export const handlers = {
  auth: authHandlers,
  billing: billingHandlers,
  device: deviceHandlers,
  orgs: orgsHandlers,
  todos: todosHandlers,
  users: usersHandlers,
};

// Only `/auth/me` has a default; every other endpoint is an unhandled request
// (an error) unless the test opts in via `server.use(...)`.
export const defaultHandlers = [authHandlers.signedOut()];
