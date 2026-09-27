// The wiring surface: what the platform names to assemble and drive this
// module. Nothing outside the platform depends on wallet, so there is no
// wallet.exports.ts; its only inbound surface is an event adapter.
export { walletCommands, walletCommandSpanAttributes } from "./wallet.command-handlers.js";
export { walletEventSpanAttributes } from "./wallet.event-span-attributes.js";
export { WalletModule } from "./wallet.module.js";
