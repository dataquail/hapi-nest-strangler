import type { HttpClient } from "../http";

export type MirroredTodo = {
  id: string;
  organizationId: string;
  title: string;
  completed: boolean;
};

const todoPath = (organizationId: string, id: string) =>
  `/internal/orgs/${organizationId}/todos/${id}`;

// The Nest server's internal todo API, which receives every write hapi makes
// while it still owns todos. The id is hapi's, so the replica keeps it.
export const createTodosApi = (http: HttpClient) => ({
  create: (organizationId: string, body: { id: string; title: string }) =>
    http.post(`/internal/orgs/${organizationId}/todos`, body) as Promise<MirroredTodo>,
  update: (organizationId: string, id: string, body: { title: string; completed: boolean }) =>
    http.put(todoPath(organizationId, id), body) as Promise<MirroredTodo>,
  complete: (organizationId: string, id: string) =>
    http.post(`${todoPath(organizationId, id)}/complete`, undefined) as Promise<MirroredTodo>,
  remove: (organizationId: string, id: string) =>
    http.delete(todoPath(organizationId, id)) as Promise<void>,
});
