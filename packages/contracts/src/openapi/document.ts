import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  type ResponseConfig,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { CliApi } from "../CliApi.js";
import { DomainApi } from "../DomainApi.js";
import * as HttpErrors from "../HttpErrors.js";
import type { ContractGroup, ErrorDefinition, RouteDefinition } from "../Route.js";

const SESSION_SCHEME = "sessionCookie";
const BEARER_SCHEME = "apiToken";

const errorResponses = (errors: ReadonlyArray<ErrorDefinition>): Record<string, ResponseConfig> => {
  const byStatus = new Map<number, Array<ErrorDefinition>>();
  for (const error of errors) {
    byStatus.set(error.status, [...(byStatus.get(error.status) ?? []), error]);
  }
  const responses: Record<string, ResponseConfig> = {};
  for (const [status, definitions] of byStatus) {
    const schemas: Array<z.ZodType> = definitions.map((definition) => definition.schema);
    const [first, ...rest] = schemas;
    if (first === undefined) continue;
    responses[String(status)] = {
      description: definitions.map((definition) => definition.description).join(" | "),
      content: {
        "application/json": {
          schema: rest.length === 0 ? first : z.union([first, ...rest]),
        },
      },
    };
  }
  return responses;
};

const toRouteConfig = (group: ContractGroup, route: RouteDefinition): RouteConfig => {
  const request: RouteConfig["request"] = {};
  if (route.params !== undefined) request.params = route.params;
  if (route.query !== undefined) request.query = route.query;
  if (route.body !== undefined) {
    request.body = { content: { "application/json": { schema: route.body } } };
  }
  const success: ResponseConfig =
    route.success.schema === undefined
      ? { description: route.success.status === 302 ? "Redirect" : "No content" }
      : {
          description: "Success",
          content: { "application/json": { schema: route.success.schema } },
        };
  return {
    method: route.method,
    path: route.path,
    operationId: route.operationId,
    tags: [group.name],
    ...(route.summary === undefined ? {} : { summary: route.summary }),
    request,
    // A secured route can always answer 401: the guard raises it before the endpoint runs.
    responses: {
      [String(route.success.status)]: success,
      ...errorResponses(
        route.security === "session" ? [...route.errors, HttpErrors.Unauthorized] : route.errors,
      ),
    },
    security:
      route.security === "session" ? [{ [SESSION_SCHEME]: [] }, { [BEARER_SCHEME]: [] }] : [],
  };
};

export type OpenApiDocument = ReturnType<OpenApiGeneratorV31["generateDocument"]>;

export const buildOpenApiDocument = (): OpenApiDocument => {
  const registry = new OpenAPIRegistry();
  registry.registerComponent("securitySchemes", SESSION_SCHEME, {
    type: "apiKey",
    in: "cookie",
    name: "session",
  });
  registry.registerComponent("securitySchemes", BEARER_SCHEME, {
    type: "http",
    scheme: "bearer",
  });
  for (const group of [...DomainApi, ...CliApi]) {
    for (const route of Object.values(group.routes)) {
      registry.registerPath(toRouteConfig(group, route));
    }
  }
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: { title: "hapi-nest-strangler API", version: "0.0.0" },
    servers: [{ url: "/" }],
  });
};
