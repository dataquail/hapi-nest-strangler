import type { RowSchemas } from "@org/database";

import { DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root.js";
import { UserId } from "@/platform/ids/user-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  deviceCodeHash: "device_code_hash",
  userCode: "user_code",
} as const satisfies Partial<Record<keyof DeviceGrantRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.DeviceGrantRow): DeviceGrantRoot =>
  DeviceGrantRoot.parse({
    id: DeviceGrantId.parse(row.id),
    deviceCodeHash: row.device_code_hash,
    userCode: row.user_code,
    status: row.status,
    userId: row.user_id === null ? null : UserId.parse(row.user_id),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    approvedAt: row.approved_at,
  });
