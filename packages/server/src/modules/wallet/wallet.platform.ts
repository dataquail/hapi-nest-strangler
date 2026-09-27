// The wiring surface: what the platform names to assemble and drive this
// module. No peer module exists on this server yet, so there is no
// wallet.exports.ts; the module's inbound surface is its internal HTTP API.
export { walletCommands, walletCommandSpanAttributes } from "./wallet.command-handlers.js";
export { walletEventSpanAttributes } from "./wallet.event-span-attributes.js";
export { WalletModule } from "./wallet.module.js";
export { walletQueries, walletQuerySpanAttributes } from "./wallet.query-handlers.js";
