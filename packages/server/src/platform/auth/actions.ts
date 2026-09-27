// This application's authorization vocabulary is CRUD (ADR-0021): a business
// operation that discriminates within one of these lives in the command, not
// here.
export const Actions = {
  Create: "create",
  Read: "read",
  Update: "update",
  Delete: "delete",
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];
