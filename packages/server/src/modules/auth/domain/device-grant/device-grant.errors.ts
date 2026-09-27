import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";

export class DeviceGrantNotFound extends TaggedError("DeviceGrantNotFound") {}
export class DeviceGrantExpired extends TaggedError("DeviceGrantExpired") {}
export class DeviceGrantPending extends TaggedError("DeviceGrantPending") {}
