import type { ServerRoute } from "@hapi/hapi";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { can } from "../../lib/access/can";
import Joi = require("../../lib/joi");
import {
  fromOwnOrganization,
  orgAndTodoParams,
  orgParams,
  todoBelongsToOrganization,
} from "./todo-route-helpers";
import type TodoService = require("./todo-service");

const { TODO } = resourceConstants;

const todoRoutes = (todoService: TodoService, rowExists: any): ServerRoute[] => [
  {
    method: "GET",
    path: "/orgs/{orgId}/todos",
    handler: (request) => todoService.listTodos((request.params as any).orgId),
    options: {
      tags: ["api"],
      description: "The organization's todos",
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
    path: "/orgs/{orgId}/todos",
    handler: async (request, h) => {
      const { title } = request.payload as { title: string };
      return h
        .response(await todoService.createTodo((request.params as any).orgId, title))
        .code(201);
    },
    options: {
      tags: ["api"],
      description: "Add a todo to the organization",
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
    method: "PUT",
    path: "/orgs/{orgId}/todos/{id}",
    handler: (request) => {
      const { completed, title } = request.payload as { title: string; completed: boolean };
      return todoService.updateTodo((request.params as any).id, { title, completed });
    },
    options: {
      tags: ["api"],
      description: "Rename or complete a todo",
      auth: "session",
      ext: {
        onPreHandler: [
          { method: todoBelongsToOrganization("TodoNotFoundError") },
          { method: can(actionConstants.EDIT, "params.id") },
        ],
      },
      validate: {
        params: orgAndTodoParams(rowExists, "TodoNotFoundError"),
        payload: Joi.object({
          title: Joi.string().trim().min(1).required(),
          completed: Joi.boolean().required(),
        }),
      },
    },
  },
  {
    method: "DELETE",
    path: "/orgs/{orgId}/todos/{id}",
    handler: async (request, h) => {
      await todoService.deleteTodo((request.params as any).id);
      return h.response().code(204);
    },
    options: {
      tags: ["api"],
      description: "Delete a todo",
      auth: "session",
      ext: {
        onPreHandler: [
          { method: todoBelongsToOrganization("TodoNotFoundError") },
          { method: can(actionConstants.DELETE, "params.id") },
        ],
      },
      validate: { params: orgAndTodoParams(rowExists, "TodoNotFoundError") },
    },
  },
];

todoRoutes["@singleton"] = true;
todoRoutes["@require"] = ["todo/todo-service", "hapi-async-validation/bookshelf/row-exists"];

export = todoRoutes;
