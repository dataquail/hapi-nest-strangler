import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { HttpProblem } from "./http-problem.js";
import { ProblemFilter } from "./problem.filter.js";

type Host = Parameters<ProblemFilter["catch"]>[1];

const definition = (tag: string, status: number) =>
  ({ tag, status, schema: undefined, description: tag }) as unknown as ConstructorParameters<
    typeof HttpProblem
  >[0];

// The unit-test tier admits no Nest import; the framework's own exception
// class is reached as the subject's parent, which is what the filter switches on.
const HttpException = Object.getPrototypeOf(HttpProblem) as new (
  response: string | Record<string, unknown>,
  status: number,
) => Error;

const serialise = (exception: unknown) => {
  const sent: { status?: number; body?: unknown } = {};
  const response = {
    status: (status: number) => {
      sent.status = status;
      return response;
    },
    json: (body: unknown) => {
      sent.body = body;
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as Host;
  new ProblemFilter().catch(exception, host);
  return sent;
};

describe("ProblemFilter", () => {
  it("writes a contract problem's status and body as they are", () => {
    const sent = serialise(
      new HttpProblem(definition("WalletNotFoundError", 404), { message: "no wallet" }),
    );
    deepStrictEqual(sent, {
      status: 404,
      body: { _tag: "WalletNotFoundError", message: "no wallet" },
    });
  });

  it("tags a framework exception by its status, reading a string or an object response", () => {
    deepStrictEqual(serialise(new HttpException("Cannot GET /nope", 404)), {
      status: 404,
      body: { _tag: "NotFound", message: "Cannot GET /nope" },
    });
    deepStrictEqual(
      serialise(new HttpException({ message: ["title is required", "id is not a uuid"] }, 400)),
      { status: 400, body: { _tag: "BadRequest", message: "title is required; id is not a uuid" } },
    );
    deepStrictEqual(serialise(new HttpException({ statusCode: 418 }, 418)), {
      status: 418,
      body: { _tag: "InternalServerError", message: "Http Exception" },
    });
  });

  it("turns anything else into a 500 with the internal-error tag", () => {
    deepStrictEqual(serialise(new Error("boom")), {
      status: 500,
      body: { _tag: "InternalServerError" },
    });
    deepStrictEqual(serialise("not even an error"), {
      status: 500,
      body: { _tag: "InternalServerError" },
    });
  });
});
