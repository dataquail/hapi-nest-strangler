import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";

export class ApiTokenNotFound extends TaggedError("ApiTokenNotFound") {}
export class ApiTokenExpired extends TaggedError("ApiTokenExpired") {}
export class ApiTokenRevoked extends TaggedError("ApiTokenRevoked") {}
