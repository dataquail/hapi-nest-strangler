// The wiring surface: what the platform names to assemble and drive this
// module. Nothing outside the platform depends on auth, so there is no
// auth.exports.ts.
export { authCommands, authCommandSpanAttributes } from "./auth.command-handlers.js";
export { AuthModule } from "./auth.module.js";
export { authQueries, authQuerySpanAttributes } from "./auth.query-handlers.js";
export { TouchApiTokenCommand } from "./commands/touch-api-token.command.js";
export { TouchSessionCommand } from "./commands/touch-session.command.js";
export { CredentialHash } from "./domain/domain-services/credential-hash.domain-service.js";
export { SessionId } from "./domain/session/session.id.js";
export { FindApiTokenByHashQuery } from "./queries/find-api-token-by-hash.query.js";
export { FindSessionQuery } from "./queries/find-session.query.js";
