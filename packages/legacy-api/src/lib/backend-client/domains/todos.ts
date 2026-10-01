import type { HttpClient } from "../http";

export type MirroredTodo = {
  id: string;
  organizationId: string;
  title: string;
  completed: boolean;
};

// The Nest server's internal todo API, which receives every write hapi makes
// while it still owns todos. The id is hapi's, so the replica keeps it.
export const createTodosApi = (http: HttpClient) => ({
  create: (organizationId: string, body: { id: string; title: string }) =>
    http.post(`/internal/orgs/${organizationId}/todos`, body) as Promise<MirroredTodo>,
});
