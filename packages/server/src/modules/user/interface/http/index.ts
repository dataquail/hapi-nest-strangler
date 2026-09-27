import { CreateUserEndpoint } from "./create.endpoint.js";
import { DeleteUserEndpoint } from "./delete.endpoint.js";
import { FindUsersEndpoint } from "./find.endpoint.js";

export const userEndpoints = [CreateUserEndpoint, FindUsersEndpoint, DeleteUserEndpoint] as const;
