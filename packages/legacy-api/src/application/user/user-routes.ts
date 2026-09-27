import type { ServerRoute } from "@hapi/hapi";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { can } from "../../lib/access/can";
import { asyncValidation } from "../../lib/hapi-async-validation";
import Joi = require("../../lib/joi");
import type UserService = require("./user-service");

const { USER } = resourceConstants;

const userRoutes = (userService: UserService, rowExists: any): ServerRoute[] => [
  {
    method: "GET",
    path: "/users",
    handler: (request) => {
      const { page, pageSize } = request.query as { page: number; pageSize: number };
      return userService.findUsers(page, pageSize);
    },
    options: {
      tags: ["api"],
      description: "List users, paginated",
      auth: "session",
      ext: {
        onPreHandler: [{ method: can(actionConstants.LIST, USER) }],
      },
      validate: {
        query: Joi.object({
          page: Joi.number().integer().min(1).required(),
          pageSize: Joi.number().integer().min(1).max(100).required(),
        }),
      },
    },
  },
  {
    method: "POST",
    path: "/users",
    handler: async (request, h) => {
      const id = await userService.createUser(request.payload as any);
      return h.response({ id }).code(201);
    },
    options: {
      tags: ["api"],
      description: "Create a user",
      auth: "session",
      ext: {
        onPreHandler: [{ method: can(actionConstants.CREATE, USER) }],
      },
      validate: {
        payload: Joi.object({
          email: Joi.string().min(3).max(255).required(),
          country: Joi.string().min(2).max(50).required(),
          street: Joi.string().min(2).max(50).required(),
          postalCode: Joi.string().min(2).max(10).required(),
        }),
      },
    },
  },
  {
    method: "DELETE",
    path: "/users/{user}",
    handler: async (request, h) => {
      await userService.deleteUser((request.params as any).user);
      return h.response().code(204);
    },
    options: {
      tags: ["api"],
      description: "Delete a user",
      auth: "session",
      ext: {
        onPreHandler: [{ method: can(actionConstants.DELETE, "params.user") }],
      },
      validate: {
        params: asyncValidation(
          { user: Joi.string().uuid().required() },
          {
            user: rowExists("user", "id", "User not found", {
              tag: "UserNotFoundError",
              fields: (userId: string) => ({ userId, message: `User ${userId} not found` }),
            }),
          },
        ),
      },
    },
  },
];

userRoutes["@singleton"] = true;
userRoutes["@require"] = ["user/user-service", "hapi-async-validation/bookshelf/row-exists"];

export = userRoutes;
