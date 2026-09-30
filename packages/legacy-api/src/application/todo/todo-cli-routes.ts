import type { ServerRoute } from "@hapi/hapi";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { can } from "../../lib/access/can";
import Joi = require("../../lib/joi");
import type TodoService = require("./todo-service");
import { fromOwnOrganization } from "./todo-access";
import { orgAndTodoParams, orgParams, todoBelongsToOrganization } from "./todo-route-helpers";

const { TODO } = resourceConstants;

// The same todos over the CLI paths, with the CLI's own not-found tag.
const todoCliRoutes = (todoService: TodoService, rowExists: any): ServerRoute[] => [
  {
    method: "GET",
    path: "/cli/orgs/{orgId}/todos",
    handler: (request) => todoService.listTodos((request.params as any).orgId),
    options: {
      tags: ["api"],
      description: "The organization's todos, for the CLI",
      auth: "session",
      ext: {
        onPreHandler: [
          { method: can(actionConstants.LIST, TODO) },
          { method: fromOwnOrganization },
        ],
      },
      validate: { params: orgParams(rowExists) },
    },
  },
  {
    method: "POST",
    path: "/cli/orgs/{orgId}/todos",
    handler: async (request, h) => {
      const { title } = request.payload as { title: string };
      return h
        .response(await todoService.createTodo((request.params as any).orgId, title))
        .code(201);
    },
    options: {
      tags: ["api"],
      description: "Add a todo, from the CLI",
      auth: "session",
      ext: {
        onPreHandler: [
          { method: can(actionConstants.CREATE, TODO) },
          { method: fromOwnOrganization },
        ],
      },
      validate: {
        params: orgParams(rowExists),
        payload: Joi.object({ title: Joi.string().trim().min(1).required() }),
      },
    },
  },
  {
    method: "POST",
    path: "/cli/orgs/{orgId}/todos/{id}/complete",
    handler: (request) => todoService.completeTodo((request.params as any).id),
    options: {
      tags: ["api"],
      description: "Complete a todo, from the CLI",
      auth: "session",
      ext: {
        onPreHandler: [
          { method: todoBelongsToOrganization("CliTodoNotFoundError") },
          { method: can(actionConstants.EDIT, "params.id") },
        ],
      },
      validate: { params: orgAndTodoParams(rowExists, "CliTodoNotFoundError") },
    },
  },
  {
    method: "DELETE",
    path: "/cli/orgs/{orgId}/todos/{id}",
    handler: async (request, h) => {
      await todoService.deleteTodo((request.params as any).id);
      return h.response().code(204);
    },
    options: {
      tags: ["api"],
      description: "Delete a todo, from the CLI",
      auth: "session",
      ext: {
        onPreHandler: [
          { method: todoBelongsToOrganization("CliTodoNotFoundError") },
          { method: can(actionConstants.DELETE, "params.id") },
        ],
      },
      validate: { params: orgAndTodoParams(rowExists, "CliTodoNotFoundError") },
    },
  },
];

todoCliRoutes["@singleton"] = true;
todoCliRoutes["@require"] = ["todo/todo-service", "hapi-async-validation/bookshelf/row-exists"];

export = todoCliRoutes;
