import { z } from "zod";

export const DeviceGrantId = z.guid().brand<"DeviceGrantId">();
export type DeviceGrantId = z.infer<typeof DeviceGrantId>;
