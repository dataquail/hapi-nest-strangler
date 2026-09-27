import { createHash } from "node:crypto";

// Applied to raw lookup input across aggregates (API tokens, device codes):
// logic with no single aggregate home (ADR-0023).
export const CredentialHash = {
  of: (raw: string): string => createHash("sha256").update(raw).digest("hex"),
} as const;
