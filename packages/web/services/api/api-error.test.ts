import { describe, expect, it } from "vitest";

import { ApiError, isApiError, unwrap } from "./api-error";

const response = (status: number) => new Response(null, { status });

describe("unwrap", () => {
  it("returns the data of a settled success", () => {
    expect(unwrap({ data: { id: 1 }, response: response(200) })).toEqual({ id: 1 });
  });

  it("throws the wire's tagged body as an ApiError carrying the status", () => {
    expect.assertions(4);
    try {
      unwrap({ error: { _tag: "Forbidden", message: "Not a member." }, response: response(403) });
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      expect((error as ApiError)._tag).toBe("Forbidden");
      expect((error as ApiError).status).toBe(403);
      expect((error as ApiError).message).toBe("Not a member.");
    }
  });

  it("folds an untagged failure into an InternalServerError", () => {
    expect(() => unwrap({ error: "boom", response: response(500) })).toThrow(ApiError);
    try {
      unwrap({ error: "boom", response: response(500) });
    } catch (error) {
      expect((error as ApiError)._tag).toBe("InternalServerError");
    }
  });
});
