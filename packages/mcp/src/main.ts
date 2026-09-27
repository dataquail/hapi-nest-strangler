#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  type CliClient,
  makeCliClient,
  readCredentials,
  resolveBaseUrl,
  resolveToken,
} from "@org/api-client";
import { z } from "zod";

// The MCP tools and the CLI run the exact same authenticated requests through
// the shared client. stdout is the JSON-RPC channel: diagnostics go to stderr.

type ToolOutcome<A> =
  { readonly ok: true; readonly value: A } | { readonly ok: false; readonly message: string };

type WireError = { readonly _tag?: unknown; readonly message?: unknown };

const friendlyError = (error: unknown): string => {
  const wire = (typeof error === "object" && error !== null ? error : {}) as WireError;
  const tag = typeof wire._tag === "string" ? wire._tag : "";
  const message = typeof wire.message === "string" ? wire.message : "";
  switch (tag) {
    case "Unauthorized":
      return "Not authorized — the token is invalid or expired.";
    case "Forbidden":
      return "No access to that organization or resource.";
    case "ServiceUnavailable":
      return "The server is temporarily unavailable.";
    case "CliTodoNotFoundError":
      return message.length > 0 ? message : "Todo not found.";
    default:
      if (error instanceof TypeError) return `Could not reach the server at ${resolveBaseUrl()}.`;
      return tag.length > 0
        ? `Request failed (${tag}).`
        : message.length > 0
          ? message
          : String(error);
  }
};

type Response<A> = { readonly data?: A; readonly error?: unknown };

// Resolves the token, runs the call, and folds every failure into an outcome
// so a tool handler never rejects on an expected error.
const callTool = async <A>(
  body: (client: CliClient) => Promise<Response<A>>,
): Promise<ToolOutcome<A>> => {
  const token = resolveToken(await readCredentials());
  if (token === null) {
    return {
      ok: false,
      message: "Not authenticated. Set APP_API_TOKEN, or run `org auth login` with the CLI.",
    };
  }
  try {
    const response = await body(makeCliClient({ baseUrl: resolveBaseUrl(), token }));
    if (response.error !== undefined) return { ok: false, message: friendlyError(response.error) };
    return { ok: true, value: response.data as A };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  }
};

const textResult = (text: string) => ({ content: [{ type: "text" as const, text }] });
const errorResult = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});
const jsonResult = (data: unknown) => textResult(JSON.stringify(data, null, 2));

const dispatch = async <A>(
  outcome: Promise<ToolOutcome<A>>,
  format: (value: A) => ReturnType<typeof textResult>,
) => {
  const result = await outcome;
  return result.ok ? format(result.value) : errorResult(result.message);
};

const server = new McpServer({ name: "org-mcp", version: "0.0.0" });

server.registerTool(
  "list_organizations",
  {
    title: "List organizations",
    description: "List the organizations the authenticated user belongs to.",
  },
  () =>
    dispatch(
      callTool((client) => client.GET("/cli/orgs")),
      jsonResult,
    ),
);

server.registerTool(
  "list_todos",
  {
    title: "List todos",
    description: "List the todos in an organization.",
    inputSchema: { orgId: z.string().describe("Organization id") },
  },
  ({ orgId }) =>
    dispatch(
      callTool((client) => client.GET("/cli/orgs/{orgId}/todos", { params: { path: { orgId } } })),
      jsonResult,
    ),
);

server.registerTool(
  "create_todo",
  {
    title: "Create todo",
    description: "Create a todo in an organization.",
    inputSchema: {
      orgId: z.string().describe("Organization id"),
      title: z.string().min(1).describe("Todo title"),
    },
  },
  ({ orgId, title }) =>
    dispatch(
      callTool((client) =>
        client.POST("/cli/orgs/{orgId}/todos", { params: { path: { orgId } }, body: { title } }),
      ),
      jsonResult,
    ),
);

server.registerTool(
  "complete_todo",
  {
    title: "Complete todo",
    description: "Mark a todo as done.",
    inputSchema: {
      orgId: z.string().describe("Organization id"),
      todoId: z.string().describe("Todo id"),
    },
  },
  ({ orgId, todoId }) =>
    dispatch(
      callTool((client) =>
        client.POST("/cli/orgs/{orgId}/todos/{id}/complete", {
          params: { path: { orgId, id: todoId } },
        }),
      ),
      jsonResult,
    ),
);

server.registerTool(
  "remove_todo",
  {
    title: "Remove todo",
    description: "Delete a todo from an organization.",
    inputSchema: {
      orgId: z.string().describe("Organization id"),
      todoId: z.string().describe("Todo id"),
    },
  },
  ({ orgId, todoId }) =>
    dispatch(
      callTool((client) =>
        client.DELETE("/cli/orgs/{orgId}/todos/{id}", { params: { path: { orgId, id: todoId } } }),
      ),
      () => textResult(`Removed todo ${todoId}.`),
    ),
);

const main = async (): Promise<void> => {
  await server.connect(new StdioServerTransport());
  process.stderr.write("org-mcp: ready on stdio\n");
};

main().catch((error: unknown) => {
  process.stderr.write(`org-mcp: fatal ${String(error)}\n`);
  process.exit(1);
});
